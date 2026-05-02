"""
Learning Outcomes Management
Handles upload, parsing, storage and retrieval of learning outcome PDFs.
Outcomes are stored separately from lecture content in a JSON file.
"""
import logging
import re
import uuid
from typing import List, Dict
from sqlalchemy.orm import Session

from .document_processor import extract_text_from_pdf
from .llm_service import generate_complete
from .models import LearningOutcome

logger = logging.getLogger(__name__)


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
1. ONLY extract statements that are explicitly presented as learning outcomes, objectives, or goals in the text. Look for contextual clues like "By the end of this lecture...", "Learning Outcomes", "Objectives:" etc.
2. DO NOT invent, infer, or hallucinate any learning outcomes. If there are no explicit learning outcomes, return an empty array [].
3. DO NOT include introductory text, headers, or surrounding paragraphs. DO NOT include every bullet point—only those that are specifically the learning outcomes.
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
            
        # Try to parse the json response using regex to find the array
        match = re.search(r'\[.*\]', response, re.DOTALL)
        if match:
            json_str = match.group(0)
        else:
            json_str = response
            
        outcomes = json.loads(json_str)
        
        if isinstance(outcomes, list) and all(isinstance(i, str) for i in outcomes):
            # Filter out empty strings or very short fragments
            return [o.strip() for o in outcomes if len(o.strip()) > 10]
        else:
            logger.warning("LLM response was not a list of strings.")
            return []
            
    except Exception as e:
        logger.error(f"Error extracting outcomes via LLM: {e}")
        return []


def extract_learning_outcomes(file_content: bytes, filename: str) -> List[str]:
    """
    Extract learning outcomes from a PDF/TXT without saving them.
    
    Args:
        file_content: PDF/TXT file bytes
        filename: Original filename
        
    Returns:
        List of extracted learning outcome strings
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
    
    # Fallback to naive regex parsing if LLM fails, so the user can see everything 
    # and delete unwanted chunks in the interactive UI.
    if not parsed_outcomes:
        logger.info("LLM extraction returned empty or failed, falling back to regex parsing.")
        parsed_outcomes = parse_learning_outcomes(raw_text)

    if not parsed_outcomes:
        raise ValueError("Could not identify any learning outcomes or bullet points in the document. Please try a different file.")

    return parsed_outcomes


def save_approved_outcomes(outcomes_list: List[str], filename: str, db: Session) -> Dict:
    """
    Save teacher-approved learning outcomes to the database.
    
    Args:
        outcomes_list: List of approved learning outcome strings
        filename: Original filename they came from
        db: Database session
        
    Returns:
        Dict with save results
    """
    if not outcomes_list:
        raise ValueError("Cannot save an empty list of outcomes.")

    # Create outcome entries
    new_outcomes = []
    for text in outcomes_list:
        outcome = LearningOutcome(
            text=text,
            source_filename=filename
        )
        db.add(outcome)
        new_outcomes.append(outcome)

    db.commit()

    # Get total count
    total_outcomes = db.query(LearningOutcome).count()

    logger.info(f"Saved {len(new_outcomes)} new learning outcomes from {filename}")

    return {
        "outcomes_added": len(new_outcomes),
        "total_outcomes": total_outcomes,
        "outcomes": [{"id": o.id, "text": o.text, "source_filename": o.source_filename, "uploaded_at": o.created_at.isoformat()} for o in new_outcomes],
    }


def get_learning_outcomes(db: Session) -> List[Dict]:
    """Get all stored learning outcomes from the database."""
    outcomes = db.query(LearningOutcome).order_by(LearningOutcome.created_at.desc()).all()
    return [{
        "id": o.id,
        "text": o.text,
        "source_filename": o.source_filename,
        "uploaded_at": o.created_at.isoformat()
    } for o in outcomes]


def delete_learning_outcome(outcome_id: str, db: Session) -> bool:
    """
    Delete a learning outcome by ID.
    
    Returns:
        True if deleted, False if not found
    """
    outcome = db.query(LearningOutcome).filter(LearningOutcome.id == outcome_id).first()
    if not outcome:
        return False
        
    db.delete(outcome)
    db.commit()
    logger.info(f"Deleted learning outcome {outcome_id}")
    return True


def clear_all_outcomes(db: Session) -> int:
    """Clear all learning outcomes. Returns count of removed items."""
    try:
        count = db.query(LearningOutcome).delete()
        db.commit()
        logger.info(f"Cleared all {count} learning outcomes")
        return count
    except Exception as e:
        db.rollback()
        logger.error(f"Error clearing outcomes: {e}")
        return 0
