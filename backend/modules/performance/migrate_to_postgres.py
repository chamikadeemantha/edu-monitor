import json
import os
import sys
from datetime import datetime

# Add the backend directory to python path for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from database import SessionLocal, engine, Base
from modules.performance.models import LearningOutcome, Quiz, QuizQuestion, QuizResponse

# Ensure tables exist
Base.metadata.create_all(bind=engine)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
OUTCOMES_FILE = os.path.join(DATA_DIR, "learning_outcomes.json")
QUIZZES_FILE = os.path.join(DATA_DIR, "quizzes.json")
RESPONSES_FILE = os.path.join(DATA_DIR, "quiz_responses.json")

def migrate():
    db = SessionLocal()
    try:
        # Migrate Learning Outcomes
        if os.path.exists(OUTCOMES_FILE):
            with open(OUTCOMES_FILE, "r", encoding="utf-8") as f:
                outcomes_data = json.load(f)
            
            for o in outcomes_data:
                # Check if exists
                if not db.query(LearningOutcome).filter_by(id=o["id"]).first():
                    db.add(LearningOutcome(
                        id=o["id"],
                        text=o["text"],
                        source_filename=o.get("source_filename"),
                        created_at=datetime.fromisoformat(o["uploaded_at"]) if "uploaded_at" in o else datetime.utcnow()
                    ))
            print(f"Migrated {len(outcomes_data)} Learning Outcomes.")

        # Migrate Quizzes
        if os.path.exists(QUIZZES_FILE):
            with open(QUIZZES_FILE, "r", encoding="utf-8") as f:
                quizzes_data = json.load(f)
                
            for q in quizzes_data:
                if not db.query(Quiz).filter_by(id=q["id"]).first():
                    created = datetime.fromisoformat(q["created_at"]) if "created_at" in q else datetime.utcnow()
                    released = datetime.fromisoformat(q["released_at"]) if q.get("released_at") else None
                    
                    quiz_db = Quiz(
                        id=q["id"],
                        difficulty=q.get("difficulty", "Beginner"),
                        num_questions=q.get("num_questions", len(q.get("questions", []))),
                        status=q.get("status", "draft"),
                        created_at=created,
                        released_at=released,
                    )
                    
                    for question in q.get("questions", []):
                        quiz_db.questions.append(QuizQuestion(
                            question=question["question"],
                            options=question["options"],
                            correct_answer=question["correctAnswer"],
                            learning_outcome=question.get("learningOutcome"),
                            difficulty=question.get("difficulty")
                        ))
                    
                    db.add(quiz_db)
            print(f"Migrated {len(quizzes_data)} Quizzes.")

        # Migrate Responses
        if os.path.exists(RESPONSES_FILE):
            with open(RESPONSES_FILE, "r", encoding="utf-8") as f:
                responses_data = json.load(f)
                
            for r in responses_data:
                if not db.query(QuizResponse).filter_by(id=r["id"]).first():
                    submitted = datetime.fromisoformat(r["submitted_at"]) if "submitted_at" in r else datetime.utcnow()
                    
                    answers_dict = {}
                    for a in r.get("answers", []):
                        answers_dict[str(a["questionId"])] = a["selectedAnswer"]
                        
                    db.add(QuizResponse(
                        id=r["id"],
                        quiz_id=r["quiz_id"],
                        student_id=r["student_id"],
                        student_name=r.get("student_name"),
                        score=r.get("score", 0),
                        total_questions=r.get("total", 0),
                        submitted_at=submitted,
                        answers=answers_dict
                    ))
            print(f"Migrated {len(responses_data)} Quiz Responses.")

        db.commit()
        print("Migration complete!")
        
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
