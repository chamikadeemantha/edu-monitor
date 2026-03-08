"""
Learning Outcomes Management
Handles upload, parsing, storage and retrieval of learning outcome PDFs.
Outcomes are stored separately from lecture content in a JSON file.
"""
import json
import logging
import os
import re
import uuid
from datetime import datetime
from typing import List, Dict, Optional

from .document_processor import extract_text_from_pdf
from .llm_service import generate_complete

logger = logging.getLogger(__name__)

# Storage path for learning outcomes
_DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
_OUTCOMES_FILE = os.path.join(_DATA_DIR, "learning_outcomes.json")


def _ensure_data_dir():
    """Ensure the data directory exists."""
    os.makedirs(_DATA_DIR, exist_ok=True)


def _load_outcomes() -> List[Dict]:
    """Load outcomes from JSON file."""
    _ensure_data_dir()
    if not os.path.exists(_OUTCOMES_FILE):
        return []
    try:
        with open(_OUTCOMES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"Error loading outcomes: {e}")
        return []


def _save_outcomes(outcomes: List[Dict]):
    """Save outcomes to JSON file."""
    _ensure_data_dir()
    with open(_OUTCOMES_FILE, "w", encoding="utf-8") as f:
        json.dump(outcomes, f, indent=2, default=str)


def parse_learning_outcomes(text: str) -> List[str]:
    """
    Parse raw text from a learning outcomes PDF into individual outcomes.
    Handles numbered lists, bulleted lists, and line-separated outcomes.
    
    Args:
        text: Raw text extracted from PDF
        
    Returns:
        List of individual learning outcome strings
    """
    outcomes = []

    # Try to split on numbered patterns like "1.", "1)", "LO1:", etc.
    numbered_pattern = r'(?:^|\n)\s*(?:LO\s*\d+[.:\-)\s]|\d+[.)\-]\s*|[•\-\*]\s*|[a-z][.)]\s*)'
    parts = re.split(numbered_pattern, text, flags=re.IGNORECASE)

    if len(parts) > 1:
        for part in parts:
            cleaned = part.strip()
            # Filter out very short fragments (headers, page numbers, etc.)
            if cleaned and len(cleaned) > 15:
                # Remove trailing whitespace and normalise
                cleaned = re.sub(r'\s+', ' ', cleaned).strip()
                outcomes.append(cleaned)
    else:
        # Fallback: split by newlines and filter meaningful lines
        for line in text.split('\n'):
            cleaned = line.strip()
            if cleaned and len(cleaned) > 15:
                cleaned = re.sub(r'\s+', ' ', cleaned).strip()
                outcomes.append(cleaned)

    return outcomes


def parse_learning_outcomes_via_llm(text: str) -> List[str]:
    """
    Use the LLM to strictly extract learning outcomes from the text.
    
    Args:
        text: Raw text extracted from PDF/TXT.
        
    Returns:
        List of individual learning outcome strings.
    """
    prompt = f"""
You are an expert curriculum analyzer. Your task is to extract learning outcomes EXACTLY as they appear in the provided text.

CRITICAL RULES:
1. ONLY extract statements that are explicitly presented as learning outcomes, objectives, or goals in the text.
2. DO NOT invent, infer, or hallucinate any learning outcomes. If there are none, return an empty array [].
3. DO NOT include introductory text, headers, or surrounding paragraphs.
4. DO NOT rephrase or rewrite the outcomes. Extract them word-for-word if possible.
5. Return the result strictly as a valid JSON array of strings. No markdown, no explanations.

Example output format:
[
  "Understand the basic principles of machine learning.",
  "Apply gradient descent to optimize a function.",
  "Evaluate the performance of a classification model."
]

TEXT TO ANALYZE:
{text}
    """
    
    system_prompt = "You are a strict data extractor. Return only a valid JSON array of strings representing the learning outcomes."
    
    try:
        response = generate_complete(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.1, # Low temperature for strict extraction
            max_tokens=2048
        )
        
        if not response:
            return []
            
        # Try to parse the json response
        # Clean up any markdown formatting if present
        cleaned_response = response.strip()
        if cleaned_response.startswith('```json'):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.endswith('```'):
            cleaned_response = cleaned_response[:-3]
        if cleaned_response.startswith('```'):
            cleaned_response = cleaned_response[3:]
            
        outcomes = json.loads(cleaned_response.strip())
        
        if isinstance(outcomes, list) and all(isinstance(i, str) for i in outcomes):
            # Filter out empty strings or very short fragments
            return [o.strip() for o in outcomes if len(o.strip()) > 10]
        else:
            logger.warning("LLM response was not a list of strings.")
            return []
            
    except Exception as e:
        logger.error(f"Error extracting outcomes via LLM: {e}")
        return []


def upload_learning_outcomes(file_content: bytes, filename: str) -> Dict:
    """
    Process a learning outcomes PDF and store the parsed outcomes.
    
    Args:
        file_content: PDF file bytes
        filename: Original filename
        
    Returns:
        Dict with upload results
    """
    # Extract text from PDF
    if filename.lower().endswith('.pdf'):
        raw_text = extract_text_from_pdf(file_content)
    elif filename.lower().endswith('.txt'):
        raw_text = file_content.decode('utf-8', errors='ignore')
    else:
        raise ValueError(f"Unsupported file type: {filename}. Use PDF or TXT.")

    if not raw_text or len(raw_text.strip()) < 10:
        raise ValueError("No meaningful text could be extracted from the file.")

    # Try to parse using LLM first for strict adherence to the document
    parsed_outcomes = parse_learning_outcomes_via_llm(raw_text)
    
    # Fallback to regex parsing if LLM fails or returns empty
    if not parsed_outcomes:
        logger.info("LLM extraction returned empty or failed, falling back to regex parsing.")
        parsed_outcomes = parse_learning_outcomes(raw_text)

    if not parsed_outcomes:
        raise ValueError("Could not identify any learning outcomes in the document.")

    # Load existing outcomes
    existing = _load_outcomes()

    # Create outcome entries
    new_outcomes = []
    for text in parsed_outcomes:
        outcome = {
            "id": str(uuid.uuid4()),
            "text": text,
            "source_filename": filename,
            "uploaded_at": datetime.utcnow().isoformat(),
        }
        new_outcomes.append(outcome)

    existing.extend(new_outcomes)
    _save_outcomes(existing)

    logger.info(f"Uploaded {len(new_outcomes)} learning outcomes from {filename}")

    return {
        "outcomes_added": len(new_outcomes),
        "total_outcomes": len(existing),
        "outcomes": new_outcomes,
    }


def get_learning_outcomes() -> List[Dict]:
    """Get all stored learning outcomes."""
    return _load_outcomes()


def delete_learning_outcome(outcome_id: str) -> bool:
    """
    Delete a learning outcome by ID.
    
    Returns:
        True if deleted, False if not found
    """
    outcomes = _load_outcomes()
    filtered = [o for o in outcomes if o["id"] != outcome_id]
    if len(filtered) == len(outcomes):
        return False
    _save_outcomes(filtered)
    logger.info(f"Deleted learning outcome {outcome_id}")
    return True


def clear_all_outcomes() -> int:
    """Clear all learning outcomes. Returns count of removed items."""
    outcomes = _load_outcomes()
    count = len(outcomes)
    _save_outcomes([])
    logger.info(f"Cleared all {count} learning outcomes")
    return count
