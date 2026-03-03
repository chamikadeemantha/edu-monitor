from __future__ import annotations

from typing import Dict, List, Optional, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime


# -----------------------------
# Survey questions (must match frontend codes)
# -----------------------------
SURVEY_CODES = [
    "A1", "A2", "A3", "A4",
    "B1", "B2", "B3", "B4",
    "C1", "C2", "C3", "C4", "C5",
    "D1", "D2", "D3", "D4", "D5",
    "E1", "E2", "E3", "E4",
    "F1", "F2", "F3", "F4", "F5", "F6",
]

# Personal factors (global, answered once)
GLOBAL_CODES = [
    "A1", "A2", "A3", "A4",
    "B1", "B2", "B3", "B4",
]

# Module-specific factors (answered per module)
MODULE_CODES = [
    "C1", "C2", "C3", "C4", "C5",
    "D1", "D2", "D3", "D4", "D5",
    "E1", "E2", "E3", "E4",
    "F1", "F2", "F3", "F4", "F5", "F6",
]

SECTION_MAP: Dict[str, List[str]] = {
    "A": ["A1", "A2", "A3", "A4"],
    "B": ["B1", "B2", "B3", "B4"],
    "C": ["C1", "C2", "C3", "C4", "C5"],
    "D": ["D1", "D2", "D3", "D4", "D5"],
    "E": ["E1", "E2", "E3", "E4"],
    "F": ["F1", "F2", "F3", "F4", "F5", "F6"],
}


def init_survey_tables(db: Session) -> None:
    """
    Creates tables if they do not exist.
    Adds module_code column for per-module surveys.
    """
    # 1) submissions table
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS survey_submissions (
            id SERIAL PRIMARY KEY,
            student_user_id INTEGER NOT NULL,
            student_reg_no VARCHAR(64),
            module_code VARCHAR(20),
            remark TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """))

    # 2) answers table
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS survey_answers (
            id SERIAL PRIMARY KEY,
            submission_id INTEGER NOT NULL,
            question_code VARCHAR(10) NOT NULL,
            value INTEGER NOT NULL,
            CONSTRAINT fk_submission
                FOREIGN KEY (submission_id)
                REFERENCES survey_submissions(id)
                ON DELETE CASCADE
        );
    """))

    # 3) Add module_code column if missing (migration for existing DBs)
    db.execute(text("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='survey_submissions' AND column_name='module_code'
        ) THEN
            ALTER TABLE survey_submissions ADD COLUMN module_code VARCHAR(20);
        END IF;
    END $$;
    """))

    # 4) indexes
    db.execute(text("""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='survey_submissions' AND column_name='student_user_id'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_survey_submissions_student_user_id
            ON survey_submissions(student_user_id);
        END IF;
    END $$;
    """))

    db.execute(text("""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='survey_answers' AND column_name='submission_id'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_survey_answers_submission_id
            ON survey_answers(submission_id);
        END IF;
    END $$;
    """))

    db.commit()


def _get_student_reg_no(db: Session, user_id: int) -> Optional[str]:
    """
    Fetch registration number from student_profiles.student_id.
    If not found, returns None.
    """
    row = db.execute(
        text("""
            SELECT student_id
            FROM student_profiles
            WHERE user_id = :uid
            LIMIT 1
        """),
        {"uid": user_id},
    ).fetchone()

    if not row:
        return None
    return row[0]


def _validate_answers(answers_list: List[Dict[str, Any]], allowed_codes: List[str] = None) -> Dict[str, int]:
    """
    Convert list -> dict, validate codes and values.
    If allowed_codes is provided, only those codes are required/accepted.
    """
    if not isinstance(answers_list, list) or len(answers_list) == 0:
        raise ValueError("Answers list is empty")

    valid_codes = allowed_codes or SURVEY_CODES

    out: Dict[str, int] = {}
    for a in answers_list:
        code = a.get("question_code")
        value = a.get("value")

        if code not in valid_codes:
            raise ValueError(f"Invalid question_code: {code}")

        if value not in [1, 2, 3, 4, 5]:
            raise ValueError(f"Invalid value for {code}: {value}")

        out[code] = int(value)

    # require all allowed questions answered
    missing = [c for c in valid_codes if c not in out]
    if missing:
        raise ValueError(f"Missing answers for: {', '.join(missing[:10])}{'...' if len(missing) > 10 else ''}")

    return out


def _compute_factor_scores(answer_map: Dict[str, int]) -> Dict[str, float]:
    scores: Dict[str, float] = {}
    for sec, codes in SECTION_MAP.items():
        vals = [answer_map[c] for c in codes if c in answer_map]
        scores[sec] = round(sum(vals) / len(vals), 4) if vals else None
    return scores


def save_survey_submission(
    db: Session,
    user_id: int,
    remark: Optional[str],
    answers_list: List[Dict[str, Any]],
    module_code: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Saves submission for logged-in user.
    If module_code is provided, this is a per-module survey (C,D,E,F only).
    If module_code is None, this is a global survey (A,B only or all questions for backward compat).
    """
    # Determine which codes to validate
    if module_code:
        allowed_codes = MODULE_CODES
    else:
        # Global submission: accept A,B codes, or all codes for backward compat
        codes_in_submission = [a.get("question_code", "") for a in answers_list]
        has_module_codes = any(c.startswith(("C", "D", "E", "F")) for c in codes_in_submission)
        if has_module_codes:
            allowed_codes = SURVEY_CODES  # backward compat: all codes
        else:
            allowed_codes = GLOBAL_CODES

    answer_map = _validate_answers(answers_list, allowed_codes)
    factor_scores = _compute_factor_scores(answer_map)

    student_reg_no = _get_student_reg_no(db, user_id)

    sub_row = db.execute(
        text("""
            INSERT INTO survey_submissions (student_user_id, student_reg_no, module_code, remark)
            VALUES (:uid, :reg, :mod, :remark)
            RETURNING id, created_at
        """),
        {"uid": user_id, "reg": student_reg_no, "mod": module_code, "remark": remark},
    ).fetchone()

    submission_id = int(sub_row[0])
    created_at = sub_row[1]

    # insert answers
    for code in allowed_codes:
        if code in answer_map:
            db.execute(
                text("""
                    INSERT INTO survey_answers (submission_id, question_code, value)
                    VALUES (:sid, :code, :val)
                """),
                {"sid": submission_id, "code": code, "val": answer_map[code]},
            )

    db.commit()

    return {
        "ok": True,
        "has_submission": True,
        "submission_id": submission_id,
        "module_code": module_code,
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
        "remark": remark,
        "student_reg_no": student_reg_no,
        "factor_scores": factor_scores,
    }


def get_latest_survey_by_user_id(db: Session, user_id: int, module_code: Optional[str] = None) -> Dict[str, Any]:
    """
    Returns latest submission + answers for this user.
    If module_code is provided, returns the latest submission for that module.
    If module_code is None, returns the latest global (A,B) submission.
    """
    if module_code:
        row = db.execute(
            text("""
                SELECT id, created_at, remark, student_reg_no, module_code
                FROM survey_submissions
                WHERE student_user_id = :uid AND module_code = :mod
                ORDER BY created_at DESC
                LIMIT 1
            """),
            {"uid": user_id, "mod": module_code},
        ).fetchone()
    else:
        row = db.execute(
            text("""
                SELECT id, created_at, remark, student_reg_no, module_code
                FROM survey_submissions
                WHERE student_user_id = :uid AND (module_code IS NULL OR module_code = '')
                ORDER BY created_at DESC
                LIMIT 1
            """),
            {"uid": user_id},
        ).fetchone()

    if not row:
        return {"has_submission": False, "answers": [], "factor_scores": {}}

    submission_id = int(row[0])
    created_at = row[1]
    remark = row[2]
    reg_no = row[3]
    mod = row[4]

    ans_rows = db.execute(
        text("""
            SELECT question_code, value
            FROM survey_answers
            WHERE submission_id = :sid
            ORDER BY question_code
        """),
        {"sid": submission_id},
    ).fetchall()

    answers = [{"question_code": r[0], "value": int(r[1])} for r in ans_rows]

    # rebuild factor scores
    amap = {a["question_code"]: a["value"] for a in answers}
    factor_scores = _compute_factor_scores(amap)

    return {
        "has_submission": True,
        "submission_id": submission_id,
        "module_code": mod,
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
        "remark": remark,
        "student_reg_no": reg_no,
        "answers": answers,
        "factor_scores": factor_scores,
    }


def get_student_modules(db: Session, user_id: int) -> List[Dict[str, Any]]:
    """
    Get the list of modules available for the student.
    First tries modules where the student has attendance records.
    Falls back to ALL available modules from sessions if student has no records.
    """
    reg_no = _get_student_reg_no(db, user_id)

    # Try 1: Modules the student has attended
    if reg_no:
        rows = db.execute(
            text("""
                SELECT DISTINCT asess.module_code, asess.module_name
                FROM attendance_records ar
                JOIN attendance_sessions asess ON asess.session_id = ar.session_id
                WHERE ar.student_id = :reg
                ORDER BY asess.module_code
            """),
            {"reg": reg_no},
        ).fetchall()

        if rows:
            return [{"module_code": r[0], "module_name": r[1]} for r in rows]

    # Fallback: ALL distinct modules from attendance sessions
    rows = db.execute(
        text("""
            SELECT DISTINCT module_code, module_name
            FROM attendance_sessions
            WHERE module_code IS NOT NULL
            ORDER BY module_code
        """)
    ).fetchall()

    return [{"module_code": r[0], "module_name": r[1]} for r in rows]


def get_survey_completion_status(db: Session, user_id: int) -> Dict[str, Any]:
    """
    Check which surveys a student has completed:
    - Global (A,B) submission
    - Per-module (C,D,E,F) submissions for each module
    """
    # Check global (A,B) submission
    global_row = db.execute(
        text("""
            SELECT id, created_at FROM survey_submissions
            WHERE student_user_id = :uid AND (module_code IS NULL OR module_code = '')
            ORDER BY created_at DESC LIMIT 1
        """),
        {"uid": user_id},
    ).fetchone()

    has_global = global_row is not None

    # Also check for legacy all-in-one submissions (backward compat)
    # If a student has a submission with all A-F answers and no module_code,
    # treat it as having completed global
    if not has_global:
        legacy_row = db.execute(
            text("""
                SELECT ss.id FROM survey_submissions ss
                JOIN survey_answers sa ON sa.submission_id = ss.id
                WHERE ss.student_user_id = :uid AND sa.question_code LIKE 'A%%'
                LIMIT 1
            """),
            {"uid": user_id},
        ).fetchone()
        has_global = legacy_row is not None

    # Get completed module surveys
    module_rows = db.execute(
        text("""
            SELECT module_code, MAX(created_at) as last_completed
            FROM survey_submissions
            WHERE student_user_id = :uid AND module_code IS NOT NULL AND module_code != ''
            GROUP BY module_code
        """),
        {"uid": user_id},
    ).fetchall()

    completed_modules = {
        r[0]: r[1].isoformat() if hasattr(r[1], "isoformat") else str(r[1])
        for r in module_rows
    }

    # Get all modules this student is enrolled in (from attendance)
    modules = get_student_modules(db, user_id)

    return {
        "has_global": has_global,
        "completed_modules": completed_modules,
        "modules": modules,
        "total_modules": len(modules),
        "completed_count": len(completed_modules),
    }
