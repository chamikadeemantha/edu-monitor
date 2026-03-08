"""
Local Speech-to-Text using Faster Whisper

Runs Whisper model locally on CPU for accurate transcription.
Model is loaded once and stays in memory for fast repeated transcription.
"""

import io
import os
import wave
import logging
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)

# Global model instance (loaded once, reused)
_model = None
_model_loading = False


def get_whisper_model():
    """
    Get or initialize the Faster Whisper model.
    Uses 'small' model for good accuracy/speed balance on CPU.
    Downloads ~500MB on first run, then cached locally.
    """
    global _model, _model_loading

    if _model is not None:
        return _model

    if _model_loading:
        return None

    _model_loading = True
    try:
        from faster_whisper import WhisperModel

        model_size = os.environ.get("WHISPER_MODEL_SIZE", "small")
        logger.info(f"Loading Faster Whisper model '{model_size}' (this may take a moment on first run)...")

        _model = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",  # Fastest on CPU with minimal accuracy loss
        )

        logger.info(f"✅ Faster Whisper model '{model_size}' loaded successfully")
        return _model

    except Exception as e:
        logger.error(f"Failed to load Whisper model: {e}")
        _model_loading = False
        return None


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> Optional[str]:
    """
    Transcribe an audio file using Faster Whisper.

    Args:
        audio_bytes: Raw audio file bytes (WAV, WebM, etc.)
        filename: Original filename (used to detect format)

    Returns:
        Transcribed text string, or None on failure
    """
    model = get_whisper_model()
    if model is None:
        logger.error("Whisper model not available")
        return None

    try:
        # Write audio to a temp file (faster-whisper needs a file path)
        suffix = os.path.splitext(filename)[1] if "." in filename else ".webm"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            # Transcribe with accuracy-focused settings
            segments, info = model.transcribe(
                tmp_path,
                language="en",
                beam_size=5,  # Higher = more accurate (was 3)
                best_of=3,  # Consider top 3 candidates
                temperature=0.0,  # Greedy decoding for consistency
                condition_on_previous_text=True,  # Use context from previous segments
                vad_filter=True,  # Skip silence
                vad_parameters=dict(
                    min_silence_duration_ms=300,
                    speech_pad_ms=200,
                ),
                no_speech_threshold=0.6,  # Filter out non-speech
                log_prob_threshold=-1.0,  # Accept segments with reasonable confidence
            )

            # Collect all segment text
            transcript_parts = []
            for segment in segments:
                text = segment.text.strip()
                if text and not _is_hallucination(text):
                    transcript_parts.append(text)

            transcript = " ".join(transcript_parts)

            if transcript:
                logger.info(f"Transcribed {len(audio_bytes)} bytes → {len(transcript)} chars")
            else:
                logger.debug("No speech detected in audio chunk")

            return transcript if transcript else None

        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return None


def _is_hallucination(text: str) -> bool:
    """
    Detect common Whisper hallucinations (repeated phrases, filler).
    """
    text_lower = text.lower().strip()
    # Common hallucination patterns
    hallucinations = [
        "thank you", "thanks for watching", "subscribe",
        "please subscribe", "like and subscribe",
        "thank you for watching", "see you next time",
        "bye", "goodbye",
    ]
    if text_lower in hallucinations:
        return True
    # Detect repeated words (e.g. "the the the the")
    words = text_lower.split()
    if len(words) >= 3 and len(set(words)) == 1:
        return True
    return False


def is_whisper_available() -> bool:
    """Check if the Whisper model is loaded and ready."""
    return _model is not None


def preload_model():
    """Pre-load the model (call during startup to avoid first-request delay)."""
    get_whisper_model()
