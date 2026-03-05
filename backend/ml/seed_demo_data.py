"""
Seed Demo Data — 6 modules with EXTREME per-module factor variation.

Design principle: Each module has ONE or TWO clearly dominant barriers
that correlate strongly with attendance. This ensures the ML Ridge Regression
model produces DIFFERENT top barriers per module.

Research alignment: Health/Well-Being (A) and Temporal/Institutional (F)
are the overall top barriers.

Run: python -m ml.seed_demo_data
"""

import sys, os, random
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from sqlalchemy import text
from database import SessionLocal
from models.auth.models import User, UserRole, StudentProfile


# ── 6 Modules ──

MODULES = [
    ("IT3011", "Theory and Practices in Statistical Modelling"),
    ("IT2030", "Data Structures and Algorithms"),
    ("IT2040", "Software Engineering Principles"),
    ("IT2050", "Database Management Systems"),
    ("IT3071", "Machine Learning and Optimization Methods"),
    ("IT4041", "Introduction to Information Security Analytics"),
]

# ── MODULE PROFILES ──
# Each module has a DOMINANT barrier. Survey scores for the dominant factor
# are HIGH (4-5) and attendance is LOW. Non-dominant factors are LOW (1-2).
# This creates a strong signal for the ML model.
#
# "dominant" = the factor(s) that most affect attendance in this module
# "barrier_score" = Likert range for the dominant factor (high = barrier exists)
# "other_score" = Likert range for all other factors (low = not a barrier)
# "att_high" / "att_low" = attendance range for students with low/high barrier scores

MODULE_PROFILES = {
    # ── Research-aligned: A (Health) is top overall barrier ──
    "IT3011": {
        "dominant": ["A", "F"],       # Health + Scheduling as top barriers
        "barrier_score": (4, 5),       # Dominant factors: high barrier
        "other_score": (1, 2),         # Other factors: low barrier
        "att_good": (82, 95),          # Students with low barrier → good attendance
        "att_poor": (35, 60),          # Students with high barrier → poor attendance
        "label": "A(Health) + F(Scheduling) dominant",
    },
    # ── Research-aligned: F (Temporal) is top barrier ──
    "IT2050": {
        "dominant": ["F"],             # Scheduling/Temporal is THE barrier
        "barrier_score": (4, 5),
        "other_score": (1, 2),
        "att_good": (80, 92),
        "att_poor": (30, 55),
        "label": "F(Temporal/Scheduling) dominant",
    },
    # ── Peer influence is the problem ──
    "IT3071": {
        "dominant": ["C"],             # Peer/Social influence is THE barrier
        "barrier_score": (4, 5),
        "other_score": (1, 2),
        "att_good": (80, 90),
        "att_poor": (40, 60),
        "label": "C(Peer/Social) dominant",
    },
    # ── Classroom/Environment is the problem ──
    "IT4041": {
        "dominant": ["D"],             # Classroom conditions
        "barrier_score": (4, 5),
        "other_score": (1, 2),
        "att_good": (78, 90),
        "att_poor": (45, 65),
        "label": "D(Classroom/Environment) dominant",
    },
    # ── Teaching quality is the problem ──
    "IT2040": {
        "dominant": ["E"],             # Teaching/Academic
        "barrier_score": (4, 5),
        "other_score": (1, 2),
        "att_good": (82, 95),
        "att_poor": (40, 62),
        "label": "E(Teaching/Academic) dominant",
    },
    # ── Good module — B (Personal) is minor issue ──
    "IT2030": {
        "dominant": ["B"],             # Personal/Self-regulation
        "barrier_score": (3, 5),
        "other_score": (1, 2),
        "att_good": (85, 98),
        "att_poor": (50, 70),
        "label": "B(Personal/Self-regulation) dominant",
    },
}

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

SESSIONS_PER_MODULE = 12  # enough data points

GLOBAL_CODES = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"]
MODULE_CODES = [
    "C1", "C2", "C3", "C4", "C5",
    "D1", "D2", "D3", "D4", "D5",
    "E1", "E2", "E3", "E4",
    "F1", "F2", "F3", "F4", "F5", "F6",
]

# Section letter for each code
def _section_of(code: str) -> str:
    return code[0]

def _random_likert(low, high):
    return max(1, min(5, random.randint(low, high)))


def _clean_demo_data(db):
    demo_regs = [s["reg"] for s in DEMO_STUDENTS]
    db.execute(text("""
        DELETE FROM survey_answers WHERE submission_id IN (
            SELECT id FROM survey_submissions WHERE student_reg_no = ANY(:regs)
        )
    """), {"regs": demo_regs})
    db.execute(text("DELETE FROM survey_submissions WHERE student_reg_no = ANY(:regs)"), {"regs": demo_regs})
    db.execute(text("DELETE FROM attendance_records WHERE session_id LIKE 'DEMO-%%'"))
    db.execute(text("DELETE FROM attendance_sessions WHERE session_id LIKE 'DEMO-%%'"))
    db.commit()
    print("[OK] Cleaned old demo data")


def seed_data():
    db = SessionLocal()

    try:
        teacher = db.query(User).filter(User.role == UserRole.TEACHER).first()
        if not teacher:
            print("[ERROR] No teacher found!")
            return
        teacher_id = teacher.id
        print(f"[OK] Using teacher ID: {teacher_id}")

        _clean_demo_data(db)

        # ── Create student accounts ──
        from passlib.context import CryptContext
        pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed = pwd_ctx.hash("demo123")
        created = 0

        for s in DEMO_STUDENTS:
            if db.query(User).filter(User.username == s["reg"]).first():
                continue
            u = User(username=s["reg"], email=f"{s['reg'].lower()}@demo.edu",
                     password_hash=hashed, role=UserRole.STUDENT, is_approved=True)
            db.add(u); db.flush()
            db.add(StudentProfile(user_id=u.id, student_id=s["reg"], full_name=s["name"]))
            created += 1

        db.commit()
        print(f"[OK] {created} new student accounts created")

        # ── Create sessions (6 modules × 12 sessions) ──
        base_date = datetime.now() - timedelta(weeks=14)
        sess_count = 0
        for mc, mn in MODULES:
            for w in range(SESSIONS_PER_MODULE):
                sid = f"DEMO-{mc}-W{w+1}"
                if db.execute(text("SELECT 1 FROM attendance_sessions WHERE session_id = :s"), {"s": sid}).fetchone():
                    continue
                sd = base_date + timedelta(weeks=w, hours=random.choice([8, 10, 13, 15]))
                db.execute(text("""
                    INSERT INTO attendance_sessions
                    (session_id, module_code, module_name, year, faculty, batch,
                     start_time, end_time, hours, location, pin, pin_expires_at,
                     max_students, remaining_slots, regen_left, teacher_id, is_active, created_at)
                    VALUES (:sid, :mc, :mn, '3rd Year', 'Faculty of Computing', 'Y3.S1',
                            :st, :et, 2, 'Room 301', '000000', :pet, 50, 50, 3, :tid, FALSE, :ca)
                """), {"sid": sid, "mc": mc, "mn": mn, "st": sd, "et": sd + timedelta(hours=2),
                       "pet": sd + timedelta(minutes=10), "tid": teacher_id, "ca": sd})
                sess_count += 1
        db.commit()
        print(f"[OK] {sess_count} sessions across {len(MODULES)} modules")

        # ── For each student: assign "barrier type" per module ──
        # Half the students will have HIGH barrier for the dominant factor,
        # half will have LOW barrier. This creates the correlation the ML needs.

        att_summary = {}
        record_count = 0
        global_survey_count = 0
        module_survey_count = 0

        for si, student in enumerate(DEMO_STUDENTS):
            user = db.query(User).filter(User.username == student["reg"]).first()
            if not user:
                continue

            # Decide if this student is "affected" or "not affected" (alternating)
            # Affected students: high barrier scores → low attendance
            # Not affected students: low barrier scores → high attendance

            for mi, (mc, mn) in enumerate(MODULES):
                prof = MODULE_PROFILES[mc]
                dominant = prof["dominant"]

                # Mix: ~60% affected usually, but IT2030 and IT2040 get very few affected 
                # to guarantee they stay >80% average attendance.
                if mc in ["IT2030", "IT2040"]:
                    is_affected = random.random() < 0.1  # Only 10% affected 
                else:
                    is_affected = random.random() < 0.65 # 65% affected

                # ── Attendance ──
                if is_affected:
                    att_pct = random.randint(*prof["att_poor"]) / 100.0
                else:
                    att_pct = random.randint(*prof["att_good"]) / 100.0

                sessions = db.execute(
                    text("SELECT session_id FROM attendance_sessions WHERE module_code = :mc AND session_id LIKE 'DEMO-%%' ORDER BY start_time"),
                    {"mc": mc}
                ).fetchall()

                attended = 0
                for sess in sessions:
                    if random.random() < att_pct:
                        db.execute(text("""
                            INSERT INTO attendance_records (session_id, student_id, marked_at, verified)
                            VALUES (:sid, :stid, NOW(), TRUE)
                        """), {"sid": sess[0], "stid": student["reg"]})
                        record_count += 1
                        attended += 1

                if mc not in att_summary:
                    att_summary[mc] = []
                if len(sessions) > 0:
                    att_summary[mc].append(round(attended / len(sessions) * 100, 1))

                # ── Per-module survey (C, D, E, F) ──
                sub = db.execute(text("""
                    INSERT INTO survey_submissions (student_user_id, student_reg_no, module_code, remark)
                    VALUES (:uid, :reg, :mc, :rmk) RETURNING id
                """), {"uid": user.id, "reg": student["reg"], "mc": mc,
                       "rmk": f"Module survey for {mc}"}).fetchone()
                sub_id = sub[0]

                for code in MODULE_CODES:
                    section = _section_of(code)
                    if section in dominant and is_affected:
                        # Dominant factor + affected → HIGH barrier score
                        val = _random_likert(*prof["barrier_score"])
                    elif section in dominant and not is_affected:
                        # Dominant factor + NOT affected → LOW barrier score
                        val = _random_likert(1, 2)
                    else:
                        # Non-dominant factor → always low
                        val = _random_likert(*prof["other_score"])

                    db.execute(text("""
                        INSERT INTO survey_answers (submission_id, question_code, value)
                        VALUES (:sid, :code, :val)
                    """), {"sid": sub_id, "code": code, "val": val})

                module_survey_count += 1

            # ── Global survey (A, B) — once per student ──
            # A (Health): affected students have high scores (research alignment)
            # B (Personal): moderate variation
            is_health_affected = random.random() < 0.5

            gsub = db.execute(text("""
                INSERT INTO survey_submissions (student_user_id, student_reg_no, module_code, remark)
                VALUES (:uid, :reg, NULL, 'Personal factors') RETURNING id
            """), {"uid": user.id, "reg": student["reg"]}).fetchone()
            gsub_id = gsub[0]

            for code in GLOBAL_CODES:
                section = _section_of(code)
                if section == "A":
                    # Health factor — high for affected students
                    val = _random_likert(4, 5) if is_health_affected else _random_likert(1, 2)
                else:  # B
                    val = _random_likert(2, 4)  # Moderate variation

                db.execute(text("""
                    INSERT INTO survey_answers (submission_id, question_code, value)
                    VALUES (:sid, :code, :val)
                """), {"sid": gsub_id, "code": code, "val": val})

            global_survey_count += 1

        db.commit()
        print(f"[OK] {record_count} attendance records")
        print(f"[OK] {global_survey_count} global surveys (A,B)")
        print(f"[OK] {module_survey_count} per-module surveys (C,D,E,F)")

        # ── Summary ──
        print("")
        print("=" * 70)
        print("SEED DATA COMPLETE")
        print("=" * 70)
        for mc, atts in att_summary.items():
            avg = sum(atts) / len(atts) if atts else 0
            p = MODULE_PROFILES[mc]
            status = "GOOD" if avg >= 80 else ("MED" if avg >= 65 else "LOW")
            print(f"  {mc}: avg {avg:5.1f}%  [{status}]  Dominant: {','.join(p['dominant'])} — {p['label']}")
        print("")
        print("  Expected ML results per module:")
        print("    IT3011 → Top barriers: A (Health) + F (Scheduling)")
        print("    IT2050 → Top barrier:  F (Temporal/Scheduling)")
        print("    IT3071 → Top barrier:  C (Peer/Social)")
        print("    IT4041 → Top barrier:  D (Classroom/Environment)")
        print("    IT2040 → Top barrier:  E (Teaching/Academic)")
        print("    IT2030 → Top barrier:  B (Personal/Self-regulation)")
        print("=" * 70)

    except Exception as e:
        db.rollback()
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
