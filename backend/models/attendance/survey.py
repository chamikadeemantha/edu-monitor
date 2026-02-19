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
    IMPORTANT: Your DB already has survey_submissions.student_user_id (NOT NULL).
    So we create/maintain schema using student_user_id, NOT user_id.
    """
    # 1) submissions table
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS survey_submissions (
            id SERIAL PRIMARY KEY,
            student_user_id INTEGER NOT NULL,
            student_reg_no VARCHAR(64),
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

    # 3) indexes (safe even if columns differ in older DBs)
    # Use DO blocks so it won't crash if a column name doesn't exist.
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
    Fetch registration number from student_profiles.student_id (your screenshot shows this column).
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


def _validate_answers(answers_list: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Convert list -> dict, validate codes and values.
    """
    if not isinstance(answers_list, list) or len(answers_list) == 0:
        raise ValueError("Answers list is empty")

    out: Dict[str, int] = {}
    for a in answers_list:
        code = a.get("question_code")
        value = a.get("value")

        if code not in SURVEY_CODES:
            raise ValueError(f"Invalid question_code: {code}")

        if value not in [1, 2, 3, 4, 5]:
            raise ValueError(f"Invalid value for {code}: {value}")

        out[code] = int(value)

    # require all questions answered (same behavior as your frontend)
    missing = [c for c in SURVEY_CODES if c not in out]
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
) -> Dict[str, Any]:
    """
    Saves submission for logged-in user.
    Uses survey_submissions.student_user_id (NOT NULL).
    Also stores student_reg_no from student_profiles.student_id.
    """
    answer_map = _validate_answers(answers_list)
    factor_scores = _compute_factor_scores(answer_map)

    student_reg_no = _get_student_reg_no(db, user_id)

    # ✅ IMPORTANT: insert student_user_id, NOT user_id
    sub_row = db.execute(
        text("""
            INSERT INTO survey_submissions (student_user_id, student_reg_no, remark)
            VALUES (:uid, :reg, :remark)
            RETURNING id, created_at
        """),
        {"uid": user_id, "reg": student_reg_no, "remark": remark},
    ).fetchone()

    submission_id = int(sub_row[0])
    created_at = sub_row[1]

    # insert answers
    for code in SURVEY_CODES:
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
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
        "remark": remark,
        "student_reg_no": student_reg_no,
        "factor_scores": factor_scores,
    }


def get_latest_survey_by_user_id(db: Session, user_id: int) -> Dict[str, Any]:
    """
    Returns latest submission + answers for this user.
    Uses student_user_id.
    """
    row = db.execute(
        text("""
            SELECT id, created_at, remark, student_reg_no
            FROM survey_submissions
            WHERE student_user_id = :uid
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

    # ✅ IMPORTANT: select question_code, not "code"
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
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
        "remark": remark,
        "student_reg_no": reg_no,
        "answers": answers,
        "factor_scores": factor_scores,
    }


def get_survey_by_student_reg_no(db: Session, reg_no: str) -> Dict[str, Any]:
    """
    Search survey submission by student registration number (e.g. IT21000000).
    Used by teacher dashboard to look up individual student results.
    """
    row = db.execute(
        text("""
            SELECT id, student_user_id, created_at, remark, student_reg_no
            FROM survey_submissions
            WHERE LOWER(student_reg_no) = LOWER(:reg)
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"reg": reg_no.strip()},
    ).fetchone()

    if not row:
        return {"found": False, "has_submission": False}

    submission_id = int(row[0])
    student_user_id = row[1]
    created_at = row[2]
    remark = row[3]
    reg = row[4]

    # get student name from student_profiles
    student_name = None
    profile_row = db.execute(
        text("""
            SELECT full_name FROM student_profiles
            WHERE user_id = :uid
            LIMIT 1
        """),
        {"uid": student_user_id},
    ).fetchone()
    if profile_row:
        student_name = profile_row[0]

    # get answers
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
    amap = {a["question_code"]: a["value"] for a in answers}
    factor_scores = _compute_factor_scores(amap)

    return {
        "found": True,
        "has_submission": True,
        "submission_id": submission_id,
        "student_reg_no": reg,
        "student_name": student_name,
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
        "remark": remark,
        "answers": answers,
        "factor_scores": factor_scores,
    }


def get_all_survey_summaries(db: Session) -> List[Dict[str, Any]]:
    """
    Return a summary list of ALL survey submissions (latest per student).
    Used by teacher dashboard for the submissions list.
    """
    rows = db.execute(
        text("""
            SELECT DISTINCT ON (student_reg_no)
                ss.id, ss.student_user_id, ss.student_reg_no, ss.created_at,
                sp.full_name
            FROM survey_submissions ss
            LEFT JOIN student_profiles sp ON sp.user_id = ss.student_user_id
            WHERE ss.student_reg_no IS NOT NULL
            ORDER BY student_reg_no, ss.created_at DESC
        """)
    ).fetchall()

    results = []
    for r in rows:
        results.append({
            "submission_id": int(r[0]),
            "student_user_id": r[1],
            "student_reg_no": r[2],
            "created_at": r[3].isoformat() if hasattr(r[3], "isoformat") else str(r[3]),
            "student_name": r[4],
        })
    return results
