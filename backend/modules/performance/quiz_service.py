"""
AI Quiz Generation Service
Generates MCQ quizzes from lecture content aligned with learning outcomes using Ollama LLM.
Stores quizzes and student responses in JSON files.
"""
import json
import logging
import os
import re
import uuid
from datetime import datetime
from typing import List, Dict, Optional

from .llm_service import generate_complete, is_ollama_available
from .vector_store import get_all_content
from .learning_outcomes import get_learning_outcomes

logger = logging.getLogger(__name__)

# Storage paths
_DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
_QUIZZES_FILE = os.path.join(_DATA_DIR, "quizzes.json")
_RESPONSES_FILE = os.path.join(_DATA_DIR, "quiz_responses.json")


def _ensure_data_dir():
    os.makedirs(_DATA_DIR, exist_ok=True)


def _load_quizzes() -> List[Dict]:
    _ensure_data_dir()
    if not os.path.exists(_QUIZZES_FILE):
        return []
    try:
        with open(_QUIZZES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def _save_quizzes(quizzes: List[Dict]):
    _ensure_data_dir()
    with open(_QUIZZES_FILE, "w", encoding="utf-8") as f:
        json.dump(quizzes, f, indent=2, default=str)


def _load_responses() -> List[Dict]:
    _ensure_data_dir()
    if not os.path.exists(_RESPONSES_FILE):
        return []
    try:
        with open(_RESPONSES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def _save_responses(responses: List[Dict]):
    _ensure_data_dir()
    with open(_RESPONSES_FILE, "w", encoding="utf-8") as f:
        json.dump(responses, f, indent=2, default=str)


# ─── LLM Prompt ────────────────────────────────────────────────────────────

QUIZ_SYSTEM_PROMPT = """You are an expert educational assessment designer.
Your job is to create multiple-choice quiz questions that:
1. Test whether students have achieved the specified learning outcomes
2. Are based ONLY on the provided lecture content
3. Cover ALL the given learning outcomes as evenly as possible
4. Have exactly 4 answer options per question with only one correct answer
5. Include varying difficulty levels as requested

You MUST respond with valid JSON only, no additional text. The JSON must be an array of question objects."""

QUIZ_GENERATION_PROMPT = """Based on the following lecture content and learning outcomes, generate {num_questions} multiple-choice questions at {difficulty} difficulty level.

LECTURE CONTENT:
{content}

LEARNING OUTCOMES TO ASSESS:
{outcomes}

Generate exactly {num_questions} questions. Each question MUST be mapped to one of the learning outcomes above.

Respond with ONLY a JSON array (no markdown, no explanation) in this exact format:
[
  {{
    "question": "The question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "learningOutcome": "The learning outcome text this question assesses",
    "difficulty": "{difficulty}"
  }}
]

IMPORTANT:
- correctAnswer is a 0-based index (0-3)
- Each question must clearly test understanding related to a learning outcome
- Options should be plausible but only one should be correct
- For Beginner: test recall and basic understanding
- For Intermediate: test application and analysis
- For Advanced: test evaluation and synthesis"""


def _parse_quiz_json(raw: str) -> List[Dict]:
    """
    Parse LLM output into a list of question dicts.
    Handles cases where the LLM wraps JSON in markdown code blocks,
    and attempts to repair gracefully if cut off by token limit.
    """
    import json
    import re
    
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r'^```\w*\n?', '', cleaned)
        cleaned = re.sub(r'\n?```$', '', cleaned)
        cleaned = cleaned.strip()

    start = cleaned.find('[')
    end = cleaned.rfind(']')
    
    # Try normal JSON parsing first
    parse_target = cleaned
    if start != -1 and end != -1 and end > start:
        parse_target = cleaned[start:end+1]
        
    try:
        questions = json.loads(parse_target)
        if not isinstance(questions, list):
            raise ValueError("Expected a JSON array")
        return questions
    except json.JSONDecodeError as e:
        logger.warning(f"Standard JSON parsing failed: {e}. Attempting robust recovery.")
        
        # Robust recovery: Extract objects by counting braces
        objects = []
        brace_count = 0
        in_string = False
        escape_next = False
        obj_start = -1
        
        for i, char in enumerate(cleaned):
            if escape_next:
                escape_next = False
                continue
                
            if char == '\\':
                escape_next = True
                continue
                
            if char == '"':
                in_string = not in_string
                continue
                
            if not in_string:
                if char == '{':
                    if brace_count == 0:
                        obj_start = i
                    brace_count += 1
                elif char == '}':
                    if brace_count > 0:
                        brace_count -= 1
                        if brace_count == 0 and obj_start != -1:
                            # We have a complete object string
                            obj_str = cleaned[obj_start:i+1]
                            try:
                                obj = json.loads(obj_str)
                                if isinstance(obj, dict) and "question" in obj:
                                    objects.append(obj)
                            except:
                                pass
                            obj_start = -1
        
        if objects:
            logger.info(f"Successfully recovered {len(objects)} complete quiz questions from cut-off JSON.")
            return objects
            
        logger.error(f"Failed to parse quiz JSON entirely.\nRaw: {raw[:500]}...")
        raise ValueError(f"LLM returned invalid JSON and recovery failed: {e}")


def generate_quiz(
    num_questions: int = 5,
    difficulty: str = "Intermediate",
) -> Dict:
    """
    Generate a quiz using Ollama LLM based on lecture content and learning outcomes.
    
    Args:
        num_questions: Number of questions to generate (1-15)
        difficulty: One of Beginner, Intermediate, Advanced

    Returns:
        Quiz dict with id, questions, metadata
    """
    if not is_ollama_available():
        raise RuntimeError(
            "Ollama LLM is not available. Please install and run Ollama to generate quizzes."
        )

    # Get learning outcomes
    outcomes = get_learning_outcomes()
    if not outcomes:
        raise ValueError(
            "No learning outcomes found. Please upload a learning outcomes PDF first."
        )

    # Get lecture content from vector store
    all_content = get_all_content(limit=50)
    if not all_content:
        raise ValueError(
            "No lecture content found. Please upload slides or submit transcripts first."
        )

    # Combine content (limit to avoid exceeding context window)
    # Give fewer chunks to leave enough token space for the output
    # (Especially if 10+ questions are requested)
    limit_chunks = 15 if num_questions < 10 else 10
    content_text = "\n\n---\n\n".join(c["text"] for c in all_content[:limit_chunks])

    # Format outcomes for the prompt
    outcomes_text = "\n".join(
        f"{i+1}. {o['text']}" for i, o in enumerate(outcomes)
    )

    # Build the prompt
    prompt = QUIZ_GENERATION_PROMPT.format(
        num_questions=num_questions,
        difficulty=difficulty,
        content=content_text,
        outcomes=outcomes_text,
    )

    logger.info(
        f"Generating {num_questions} {difficulty} questions from "
        f"{min(len(all_content), limit_chunks)} content chunks and {len(outcomes)} outcomes"
    )

    # Call LLM (non-streaming for structured output)
    # Set max_tokens high enough to accommodate large JSON outputs
    raw_response = generate_complete(
        prompt=prompt,
        system_prompt=QUIZ_SYSTEM_PROMPT,
        temperature=0.4,
        max_tokens=8192,
    )

    if not raw_response:
        raise RuntimeError("LLM returned an empty response. Please try again.")

    # Parse the JSON response
    questions = _parse_quiz_json(raw_response)

    # Validate and normalise each question
    validated = []
    for i, q in enumerate(questions):
        if not all(k in q for k in ("question", "options", "correctAnswer")):
            logger.warning(f"Skipping malformed question {i}: {q}")
            continue
        if not isinstance(q["options"], list) or len(q["options"]) != 4:
            logger.warning(f"Skipping question {i} with bad options count")
            continue
        correct = q["correctAnswer"]
        if not isinstance(correct, int) or correct < 0 or correct > 3:
            correct = 0
        validated.append({
            "id": i + 1,
            "question": str(q["question"]),
            "options": [str(o) for o in q["options"]],
            "correctAnswer": correct,
            "learningOutcome": q.get("learningOutcome", ""),
            "difficulty": q.get("difficulty", difficulty),
        })

    if not validated:
        raise RuntimeError(
            "LLM generated questions but none were in a valid format. Please try again."
        )

    # Create quiz object
    quiz = {
        "id": str(uuid.uuid4()),
        "questions": validated,
        "difficulty": difficulty,
        "num_questions": len(validated),
        "status": "draft",  # draft | released
        "created_at": datetime.utcnow().isoformat(),
        "released_at": None,
    }

    # Save
    quizzes = _load_quizzes()
    quizzes.append(quiz)
    _save_quizzes(quizzes)

    logger.info(f"Generated quiz {quiz['id']} with {len(validated)} questions")
    return quiz


# ─── Quiz CRUD ──────────────────────────────────────────────────────────────

def get_all_quizzes() -> List[Dict]:
    """Get all quizzes."""
    return _load_quizzes()


def get_quiz(quiz_id: str) -> Optional[Dict]:
    """Get a specific quiz by ID."""
    for q in _load_quizzes():
        if q["id"] == quiz_id:
            return q
    return None


def release_quiz(quiz_id: str) -> Optional[Dict]:
    """Mark a quiz as released to students."""
    quizzes = _load_quizzes()
    for q in quizzes:
        if q["id"] == quiz_id:
            q["status"] = "released"
            q["released_at"] = datetime.utcnow().isoformat()
            _save_quizzes(quizzes)
            logger.info(f"Released quiz {quiz_id}")
            return q
    return None


def delete_quiz(quiz_id: str) -> bool:
    """Delete a quiz."""
    quizzes = _load_quizzes()
    filtered = [q for q in quizzes if q["id"] != quiz_id]
    if len(filtered) == len(quizzes):
        return False
    _save_quizzes(filtered)
    logger.info(f"Deleted quiz {quiz_id}")
    return True


def get_released_quizzes() -> List[Dict]:
    """Get only released quizzes (student-facing)."""
    return [q for q in _load_quizzes() if q["status"] == "released"]


# ─── Student Responses ──────────────────────────────────────────────────────

def submit_quiz_response(
    quiz_id: str,
    student_id: str,
    student_name: str,
    answers: List[Dict],
) -> Dict:
    """
    Submit a student's quiz answers.
    
    Args:
        quiz_id: ID of the quiz
        student_id: Student identifier
        student_name: Student display name
        answers: List of {questionId, selectedAnswer}
    
    Returns:
        Results dict with score and per-question results
    """
    quiz = get_quiz(quiz_id)
    if not quiz:
        raise ValueError(f"Quiz {quiz_id} not found")

    # Grade the answers
    results = []
    correct_count = 0
    for ans in answers:
        q_id = ans.get("questionId")
        selected = ans.get("selectedAnswer")
        # Find matching question
        question = None
        for q in quiz["questions"]:
            if q["id"] == q_id:
                question = q
                break
        if question is None:
            continue
        is_correct = selected == question["correctAnswer"]
        if is_correct:
            correct_count += 1
        results.append({
            "questionId": q_id,
            "selectedAnswer": selected,
            "correctAnswer": question["correctAnswer"],
            "isCorrect": is_correct,
            "learningOutcome": question.get("learningOutcome", ""),
        })

    # Build response record
    response = {
        "id": str(uuid.uuid4()),
        "quiz_id": quiz_id,
        "student_id": student_id,
        "student_name": student_name,
        "answers": results,
        "score": correct_count,
        "total": len(results),
        "percentage": round(correct_count / len(results) * 100) if results else 0,
        "submitted_at": datetime.utcnow().isoformat(),
    }

    # Save
    responses = _load_responses()
    responses.append(response)
    _save_responses(responses)

    logger.info(
        f"Student {student_name} submitted quiz {quiz_id}: "
        f"{correct_count}/{len(results)} correct"
    )

    return response


def get_quiz_responses(quiz_id: Optional[str] = None) -> List[Dict]:
    """Get student responses, optionally filtered by quiz ID."""
    responses = _load_responses()
    if quiz_id:
        return [r for r in responses if r["quiz_id"] == quiz_id]
    return responses
