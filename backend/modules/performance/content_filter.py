"""
Content Filter
Uses LLM to filter raw speech transcripts and extract meaningful content.
"""
import re
from typing import List
from .llm_service import filter_transcript


# Common filler words and phrases to remove
FILLER_PATTERNS = [
    r'\b(um+|uh+|er+|ah+|hmm+)\b',
    r'\b(you know|i mean|like|basically|actually|literally|obviously)\b',
    r'\b(so+|well|okay|ok|right|yeah|yep)\b',
    r'\b(kind of|sort of|type of)\b',
]


def quick_clean_transcript(text: str) -> str:
    """
    Quick regex-based cleaning of transcript.
    Removes obvious filler words before sending to LLM.
    """
    cleaned = text.lower()
    
    # Remove filler patterns
    for pattern in FILLER_PATTERNS:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
    
    # Clean up multiple spaces
    cleaned = re.sub(r'\s+', ' ', cleaned)
    
    # Clean up punctuation
    cleaned = re.sub(r'\s+([.,!?;:])', r'\1', cleaned)
    
    return cleaned.strip()


def is_meaningful_segment(text: str, min_words: int = 10) -> bool:
    """
    Check if a text segment contains meaningful content.
    """
    if not text:
        return False
    
    words = text.split()
    
    # Too short
    if len(words) < min_words:
        return False
    
    # Check for educational content indicators
    educational_keywords = [
        'means', 'define', 'example', 'because', 'therefore',
        'concept', 'important', 'remember', 'note', 'key',
        'first', 'second', 'third', 'finally', 'however',
        'process', 'method', 'step', 'explain', 'understand'
    ]
    
    text_lower = text.lower()
    has_educational_content = any(kw in text_lower for kw in educational_keywords)
    
    return has_educational_content or len(words) >= 20


def filter_and_clean_transcript(
    raw_transcript: str,
    use_llm: bool = True,
    min_length: int = 50
) -> str:
    """
    Filter and clean a raw transcript.
    
    Args:
        raw_transcript: Raw speech-to-text output
        use_llm: Whether to use LLM for intelligent filtering
        min_length: Minimum character length to process
    
    Returns:
        Cleaned, meaningful content
    """
    if not raw_transcript or len(raw_transcript) < min_length:
        return ""
    
    # Quick clean first
    pre_cleaned = quick_clean_transcript(raw_transcript)
    
    # Check if there's meaningful content
    if not is_meaningful_segment(pre_cleaned, min_words=5):
        return ""
    
    # Use LLM for intelligent filtering if enabled
    if use_llm and len(pre_cleaned) > 100:
        try:
            cleaned = filter_transcript(pre_cleaned)
            # Validate LLM output
            if cleaned and len(cleaned) > 20 and not cleaned.startswith("[Error"):
                return cleaned.strip()
        except Exception:
            pass  # Fall back to pre-cleaned version
    
    return pre_cleaned


def batch_filter_transcripts(
    transcript_segments: List[str],
    use_llm: bool = True
) -> List[str]:
    """
    Filter multiple transcript segments.
    
    Args:
        transcript_segments: List of raw transcript segments
        use_llm: Whether to use LLM for filtering
    
    Returns:
        List of cleaned segments (empty ones removed)
    """
    cleaned_segments = []
    
    for segment in transcript_segments:
        cleaned = filter_and_clean_transcript(segment, use_llm)
        if cleaned:
            cleaned_segments.append(cleaned)
    
    return cleaned_segments
