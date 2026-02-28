"""
Seed Demo Data - Populate sample students with survey + attendance data for ML demo.

Run: python -m ml.seed_demo_data
From: backend/ directory
"""

import sys
import os
import random
from datetime import datetime, timedelta

# Add parent directory to path so we can import from backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Fix encoding for Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from sqlalchemy import text
from database import SessionLocal
from models.auth.models import User, UserRole, StudentProfile


# --- Configuration ---

MODULES = [
    ("IT3011", "Theory and Practices in Statistical Modelling"),
    ("IT2030", "Data Structures and Algorithms"),
    ("IT2040", "Software Engineering Principles"),
    ("IT2050", "Database Management Systems"),
]

DEMO_STUDENTS = [
    {"reg": "IT22560001", "name": "Amal Perera"},
    {"reg": "IT22560002", "name": "Nimal Silva"},
    {"reg": "IT22560003", "name": "Kasun Bandara"},
    {"reg": "IT22560004", "name": "Sanduni Fernando"},
    {"reg": "IT22560005", "name": "Dinesh Jayawardena"},
    {"reg": "IT22560006", "name": "Hasini Rajapaksa"},
    {"reg": "IT22560007", "name": "Tharindu Kumara"},
    {"reg": "IT22560008", "name": "Kavindi de Silva"},
    {"reg": "IT22560009", "name": "Ruwan Dissanayake"},
    {"reg": "IT22560010", "name": "Ishara Wickramasinghe"},
    {"reg": "IT22560011", "name": "Lahiru Gamage"},
    {"reg": "IT22560012", "name": "Sachini Herath"},
    {"reg": "IT22560013", "name": "Chaminda Weerasinghe"},
    {"reg": "IT22560014", "name": "Nethmi Gunawardena"},
    {"reg": "IT22560015", "name": "Pasan Rathnayake"},
]

SESSIONS_PER_MODULE = 10

# Survey question codes
SURVEY_CODES = [
    "A1", "A2", "A3", "A4",
    "B1", "B2", "B3", "B4",
    "C1", "C2", "C3", "C4", "C5",
    "D1", "D2", "D3", "D4", "D5",
    "E1", "E2", "E3", "E4",
    "F1", "F2", "F3", "F4", "F5", "F6",
]

# Student attendance profiles - designed so Factor F and A come out as top predictors
# Higher factor score = more barriers = lower attendance
STUDENT_PROFILES = [
    # High F + A scores = low attendance (matches research findings)
    {"type": "high_risk",    "F_range": (4, 5), "A_range": (4, 5), "att_range": (45, 65)},
    {"type": "high_risk",    "F_range": (4, 5), "A_range": (3, 4), "att_range": (50, 65)},
    {"type": "medium_risk",  "F_range": (3, 4), "A_range": (3, 4), "att_range": (65, 78)},
    {"type": "medium_risk",  "F_range": (3, 4), "A_range": (2, 3), "att_range": (70, 80)},
    {"type": "medium_risk",  "F_range": (2, 3), "A_range": (3, 4), "att_range": (68, 78)},
    # Low F + A = high attendance
    {"type": "low_risk",     "F_range": (1, 2), "A_range": (1, 2), "att_range": (85, 98)},
    {"type": "low_risk",     "F_range": (1, 2), "A_range": (2, 3), "att_range": (82, 95)},
    {"type": "low_risk",     "F_range": (2, 3), "A_range": (1, 2), "att_range": (80, 92)},
    {"type": "low_risk",     "F_range": (1, 2), "A_range": (1, 2), "att_range": (88, 98)},
    {"type": "low_risk",     "F_range": (1, 3), "A_range": (1, 3), "att_range": (78, 90)},
    # Mixed profiles
    {"type": "mixed",        "F_range": (3, 5), "A_range": (1, 2), "att_range": (60, 75)},
    {"type": "mixed",        "F_range": (1, 2), "A_range": (3, 5), "att_range": (65, 78)},
    {"type": "mixed",        "F_range": (2, 4), "A_range": (2, 4), "att_range": (65, 82)},
    {"type": "low_risk",     "F_range": (1, 2), "A_range": (1, 2), "att_range": (90, 98)},
    {"type": "high_risk",    "F_range": (4, 5), "A_range": (4, 5), "att_range": (40, 58)},
]


def _random_likert(low, high):
    """Random Likert value within range, clipped to 1-5."""
    return max(1, min(5, random.randint(low, high)))


def seed_data():
    db = SessionLocal()
    teacher_id = None

    try:
        # Find existing teacher using ORM
        teacher_user = db.query(User).filter(User.role == UserRole.TEACHER).first()
        if not teacher_user:
            print("[ERROR] No teacher found. Create a teacher account first.")
            return
        teacher_id = teacher_user.id
        print(f"[OK] Using teacher ID: {teacher_id}")

        # --- Create student accounts using ORM ---
        created_count = 0
        for student in DEMO_STUDENTS:
            existing = db.query(User).filter(User.username == student["reg"]).first()
            if existing:
                print(f"  [SKIP] Student {student['reg']} already exists")
                continue

            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            hashed_pw = pwd_context.hash("demo123")

            new_user = User(
                username=student["reg"],
                email=f"{student['reg'].lower()}@demo.edu",
                password_hash=hashed_pw,
                role=UserRole.STUDENT,
                is_approved=True,
            )
            db.add(new_user)
            db.flush()  # Get the ID

            new_profile = StudentProfile(
                user_id=new_user.id,
                student_id=student["reg"],
                full_name=student["name"],
            )
            db.add(new_profile)
            created_count += 1

        db.commit()
        print(f"[OK] Created {created_count} new student accounts")

        # --- Create attendance sessions ---
        session_count = 0
        base_date = datetime.now() - timedelta(weeks=14)

        for mod_code, mod_name in MODULES:
            for week in range(SESSIONS_PER_MODULE):
                session_date = base_date + timedelta(weeks=week, hours=random.choice([8, 10, 13, 15]))
                session_id = f"DEMO-{mod_code}-W{week+1}"

                # Check if session already exists
                existing = db.execute(
                    text("SELECT id FROM attendance_sessions WHERE session_id = :sid"),
                    {"sid": session_id},
                ).fetchone()
                if existing:
                    continue

                db.execute(
                    text("""
                        INSERT INTO attendance_sessions
                        (session_id, module_code, module_name, year, faculty, batch,
                         start_time, end_time, hours, location, pin, pin_expires_at,
                         max_students, remaining_slots, regen_left, teacher_id, is_active, created_at)
                        VALUES
                        (:sid, :mc, :mn, '3rd Year', 'Faculty of Computing', 'Y3.S1',
                         :st, :et, 2, 'Room 301', '000000', :pet,
                         50, 50, 3, :tid, FALSE, :ca)
                    """),
                    {
                        "sid": session_id,
                        "mc": mod_code,
                        "mn": mod_name,
                        "st": session_date,
                        "et": session_date + timedelta(hours=2),
                        "pet": session_date + timedelta(minutes=10),
                        "tid": teacher_id,
                        "ca": session_date,
                    },
                )
                session_count += 1

        db.commit()
        print(f"[OK] Created {session_count} attendance sessions across {len(MODULES)} modules")

        # --- Create attendance records ---
        record_count = 0

        for i, student in enumerate(DEMO_STUDENTS):
            profile = STUDENT_PROFILES[i % len(STUDENT_PROFILES)]
            att_target = random.uniform(*profile["att_range"]) / 100.0

            for mod_code, mod_name in MODULES:
                # Get all sessions for this module
                sessions = db.execute(
                    text("SELECT session_id FROM attendance_sessions WHERE module_code = :mc ORDER BY start_time"),
                    {"mc": mod_code},
                ).fetchall()

                for sess in sessions:
                    # Attend based on target attendance rate
                    if random.random() < att_target:
                        # Check if record already exists
                        existing = db.execute(
                            text("""
                                SELECT id FROM attendance_records
                                WHERE session_id = :sid AND student_id = :stid
                            """),
                            {"sid": sess[0], "stid": student["reg"]},
                        ).fetchone()

                        if not existing:
                            db.execute(
                                text("""
                                    INSERT INTO attendance_records (session_id, student_id, marked_at, verified)
                                    VALUES (:sid, :stid, NOW(), TRUE)
                                """),
                                {"sid": sess[0], "stid": student["reg"]},
                            )
                            record_count += 1

        db.commit()
        print(f"[OK] Created {record_count} attendance records")

        # --- Create survey submissions ---
        survey_count = 0

        for i, student in enumerate(DEMO_STUDENTS):
            profile = STUDENT_PROFILES[i % len(STUDENT_PROFILES)]

            # Get user_id
            user = db.query(User).filter(User.username == student["reg"]).first()
            if not user:
                continue
            user_id = user.id

            # Check if survey already exists
            existing = db.execute(
                text("SELECT id FROM survey_submissions WHERE student_reg_no = :reg"),
                {"reg": student["reg"]},
            ).fetchone()
            if existing:
                print(f"  [SKIP] Survey for {student['reg']} already exists")
                continue

            # Create survey submission
            sub_row = db.execute(
                text("""
                    INSERT INTO survey_submissions (student_user_id, student_reg_no, remark)
                    VALUES (:uid, :reg, 'Demo survey submission')
                    RETURNING id
                """),
                {"uid": user_id, "reg": student["reg"]},
            ).fetchone()
            sub_id = sub_row[0]

            # Generate answers matching the profile
            for code in SURVEY_CODES:
                if code.startswith("F"):
                    value = _random_likert(*profile["F_range"])
                elif code.startswith("A"):
                    value = _random_likert(*profile["A_range"])
                elif code.startswith("E"):
                    value = _random_likert(2, 4)
                elif code.startswith("B"):
                    value = _random_likert(2, 4)
                elif code.startswith("C"):
                    value = _random_likert(1, 3)
                elif code.startswith("D"):
                    value = _random_likert(1, 3)
                else:
                    value = _random_likert(1, 5)

                db.execute(
                    text("""
                        INSERT INTO survey_answers (submission_id, question_code, value)
                        VALUES (:sid, :code, :val)
                    """),
                    {"sid": sub_id, "code": code, "val": value},
                )

            survey_count += 1

        db.commit()
        print(f"[OK] Created {survey_count} survey submissions with answers")

        # --- Summary ---
        print("")
        print("=" * 60)
        print("SEED DATA COMPLETE!")
        print("=" * 60)
        print(f"  Students:           {len(DEMO_STUDENTS)}")
        print(f"  Modules:            {len(MODULES)}")
        print(f"  Sessions/module:    {SESSIONS_PER_MODULE}")
        print(f"  Total sessions:     {len(MODULES) * SESSIONS_PER_MODULE}")
        print(f"  Attendance records: {record_count}")
        print(f"  Survey submissions: {survey_count}")
        print("")
        print("  ML Dashboard: http://localhost:3000/teacher/attendance/ml-insights")
        print("  API Overview: http://localhost:8000/api/ml/overview")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()

