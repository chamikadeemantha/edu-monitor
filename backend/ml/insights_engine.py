"""
ML Insights Engine — Core data pipeline, model training, and recommendation generation.

Reads existing survey + attendance data, trains Random Forest model,
and produces prescriptive insights for educators.
"""

from __future__ import annotations

import time
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import text

from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import r2_score, mean_absolute_error

logger = logging.getLogger(__name__)

# ─── Factor Definitions ────────────────────────────────────────────────
SECTION_MAP: Dict[str, List[str]] = {
    "A": ["A1", "A2", "A3", "A4"],
    "B": ["B1", "B2", "B3", "B4"],
    "C": ["C1", "C2", "C3", "C4", "C5"],
    "D": ["D1", "D2", "D3", "D4", "D5"],
    "E": ["E1", "E2", "E3", "E4"],
    "F": ["F1", "F2", "F3", "F4", "F5", "F6"],
}

FACTOR_NAMES: Dict[str, str] = {
    "A": "Health & Well-Being",
    "B": "Personal & Self-Regulation",
    "C": "Peer & Social Influence",
    "D": "Environmental & Classroom",
    "E": "Academic & Teaching-Related",
    "F": "Temporal & Institutional",
}

# ─── Recommendation Templates ──────────────────────────────────────────
RECOMMENDATION_MAP: Dict[str, Dict[str, Any]] = {
    "F": {
        "severity": "critical",
        "title": "Scheduling Conflicts Are the #1 Barrier",
        "description": "Temporal factors dominate attendance variation. Students struggle with timetable conflicts, late-evening sessions, and exam-period scheduling.",
        "actions": [
            "Review session timing for conflicts with other modules",
            "Avoid scheduling lectures during exam preparation weeks",
            "Consider morning sessions instead of late-evening slots",
        ],
    },
    "A": {
        "severity": "warning",
        "title": "Health & Well-Being Issues Are Significant",
        "description": "Physical and mental health barriers significantly affect attendance patterns.",
        "actions": [
            "Add short breaks in sessions longer than 2 hours",
            "Consider flexible attendance policies for health-related absences",
            "Share wellness resources with students",
        ],
    },
    "E": {
        "severity": "info",
        "title": "Academic Engagement Needs Attention",
        "description": "Teaching methods and academic content relevance affect student attendance.",
        "actions": [
            "Incorporate interactive elements (polls, quizzes, discussions)",
            "Connect lecture content to practical applications",
            "Gather mid-semester feedback on teaching effectiveness",
        ],
    },
    "B": {
        "severity": "info",
        "title": "Self-Regulation Issues Detected",
        "description": "Motivation and time management challenges affect attendance.",
        "actions": [
            "Introduce mentoring programs or accountability structures",
            "Send attendance reminders before sessions",
            "Create clear assessment-attendance links",
        ],
    },
    "C": {
        "severity": "info",
        "title": "Peer & Social Influence Detected",
        "description": "Friend groups and social dynamics influence attendance decisions.",
        "actions": [
            "Encourage group-based learning activities",
            "Create study groups with mixed attendance patterns",
            "Use peer learning and collaborative tasks",
        ],
    },
    "D": {
        "severity": "info",
        "title": "Classroom Environment Matters",
        "description": "Physical classroom conditions affect student attendance decisions.",
        "actions": [
            "Report facility issues to administration",
            "Request room improvements or changes",
            "Adjust seating arrangements for better engagement",
        ],
    },
}

# ─── Model Cache ────────────────────────────────────────────────────────
_model_cache: Dict[str, Any] = {
    "global": None,
    "modules": {},
    "last_trained_at": None,
    "submission_count_at_training": 0,
}


def _should_retrain(db: Session, cache_key: str = "global") -> bool:
    """Check if model needs retraining (24hr timeout or 10+ new submissions)."""
    if cache_key == "global" and _model_cache["global"] is None:
        return True
    if cache_key != "global" and cache_key not in _model_cache["modules"]:
        return True

    # Time-based: retrain after 24 hours
    if _model_cache["last_trained_at"]:
        elapsed = time.time() - _model_cache["last_trained_at"]
        if elapsed > 86400:  # 24 hours
            return True

    # Submission-based: retrain if 10+ new surveys since last training
    try:
        row = db.execute(text("SELECT COUNT(*) FROM survey_submissions")).fetchone()
        current_count = row[0] if row else 0
        if current_count - _model_cache["submission_count_at_training"] >= 10:
            return True
    except Exception:
        pass

    return False


def _update_cache_metadata(db: Session):
    """Update cache timestamps and counters."""
    _model_cache["last_trained_at"] = time.time()
    try:
        row = db.execute(text("SELECT COUNT(*) FROM survey_submissions")).fetchone()
        _model_cache["submission_count_at_training"] = row[0] if row else 0
    except Exception:
        _model_cache["submission_count_at_training"] = 0


# ─── Phase 1: Data Connection Layer ────────────────────────────────────

def _compute_factor_scores_from_answers(answers: Dict[str, int]) -> Dict[str, float]:
    """Compute factor A-F scores from raw survey answer values."""
    scores: Dict[str, float] = {}
    for section, codes in SECTION_MAP.items():
        vals = [answers[c] for c in codes if c in answers]
        scores[section] = round(sum(vals) / len(vals), 4) if vals else None
    return scores


def build_dataset(db: Session, module_code: Optional[str] = None, teacher_id: Optional[int] = None) -> pd.DataFrame:
    """
    Build the joined dataset: factor scores + attendance % per student per module.

    Joins:
      survey_submissions.student_reg_no = attendance_records.student_id
      survey_answers.submission_id = survey_submissions.id
      attendance_records.session_id = attendance_sessions.session_id
    """
    # Step 1: Get all students who have survey submissions with their answers
    survey_query = text("""
        SELECT
            ss.id AS submission_id,
            ss.student_reg_no,
            sa.question_code,
            sa.value
        FROM survey_submissions ss
        JOIN survey_answers sa ON sa.submission_id = ss.id
        WHERE ss.student_reg_no IS NOT NULL
        AND ss.id IN (
            SELECT MAX(id) FROM survey_submissions
            WHERE student_reg_no IS NOT NULL
            GROUP BY student_reg_no
        )
        ORDER BY ss.student_reg_no, sa.question_code
    """)

    try:
        survey_rows = db.execute(survey_query).fetchall()
    except Exception as e:
        logger.error(f"Failed to query survey data: {e}")
        return pd.DataFrame()

    if not survey_rows:
        logger.warning("No survey data found")
        return pd.DataFrame()

    # Group answers by student
    student_answers: Dict[str, Dict[str, int]] = {}
    for row in survey_rows:
        reg_no = row[1]
        q_code = row[2]
        value = row[3]
        if reg_no not in student_answers:
            student_answers[reg_no] = {}
        student_answers[reg_no][q_code] = value

    # Compute factor scores for each student
    student_factors: Dict[str, Dict[str, float]] = {}
    for reg_no, answers in student_answers.items():
        student_factors[reg_no] = _compute_factor_scores_from_answers(answers)

    # Step 2: Get attendance % per student per module
    att_params = {}
    att_filters = []
    if module_code:
        att_filters.append("asess.module_code = :module_code")
        att_params["module_code"] = module_code
    if teacher_id:
        att_filters.append("asess.teacher_id = :teacher_id")
        att_params["teacher_id"] = teacher_id

    att_where = ""
    if att_filters:
        att_where = "AND " + " AND ".join(att_filters)

    attendance_query = text(f"""
        SELECT
            ar.student_id,
            asess.module_code,
            asess.module_name,
            COUNT(ar.id) AS sessions_attended,
            (
                SELECT COUNT(*)
                FROM attendance_sessions asess2
                WHERE asess2.module_code = asess.module_code
                {"AND asess2.teacher_id = :teacher_id" if teacher_id else ""}
            ) AS total_sessions
        FROM attendance_records ar
        JOIN attendance_sessions asess ON asess.session_id = ar.session_id
        WHERE ar.student_id IS NOT NULL
        {att_where}
        GROUP BY ar.student_id, asess.module_code, asess.module_name
    """)

    try:
        att_rows = db.execute(attendance_query, att_params).fetchall()
    except Exception as e:
        logger.error(f"Failed to query attendance data: {e}")
        return pd.DataFrame()

    if not att_rows:
        logger.warning("No attendance data found")
        return pd.DataFrame()

    # Step 3: Join — only students who have BOTH survey + attendance
    rows = []
    for att_row in att_rows:
        student_id = att_row[0]
        mod_code = att_row[1]
        mod_name = att_row[2]
        attended = att_row[3]
        total = att_row[4]

        if student_id not in student_factors:
            continue  # No survey data for this student

        if total == 0:
            continue

        att_pct = round((attended / total) * 100, 1)
        factors = student_factors[student_id]

        rows.append({
            "student_id": student_id,
            "module_code": mod_code,
            "module_name": mod_name,
            "Factor_A": factors.get("A"),
            "Factor_B": factors.get("B"),
            "Factor_C": factors.get("C"),
            "Factor_D": factors.get("D"),
            "Factor_E": factors.get("E"),
            "Factor_F": factors.get("F"),
            "attendance_pct": att_pct,
        })

    df = pd.DataFrame(rows)
    logger.info(f"Built dataset: {len(df)} rows, {df['student_id'].nunique() if len(df) > 0 else 0} students")
    return df


# ─── Phase 2: ML Training & Analysis ───────────────────────────────────

def train_and_analyze(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Train Random Forest + Linear Regression baseline on factor scores.
    Returns model metrics, feature importance, and trained model.
    """
    factor_cols = ["Factor_A", "Factor_B", "Factor_C", "Factor_D", "Factor_E", "Factor_F"]

    # Drop rows with missing factor scores
    df_clean = df.dropna(subset=factor_cols + ["attendance_pct"])

    if len(df_clean) < 5:
        return {
            "status": "insufficient_data",
            "message": f"Need at least 5 students with both survey and attendance data. Currently have {len(df_clean)}.",
            "students_available": len(df_clean),
        }

    X = df_clean[factor_cols].values
    y = df_clean["attendance_pct"].values

    # Train/test split (use all data if < 10 samples, otherwise 80/20)
    if len(X) < 10:
        X_train, X_test, y_train, y_test = X, X, y, y
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

    # ── Random Forest (primary model) ──
    rf_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("rf", RandomForestRegressor(n_estimators=400, random_state=42)),
    ])
    rf_pipeline.fit(X_train, y_train)
    rf_pred = rf_pipeline.predict(X_test)
    rf_r2 = round(r2_score(y_test, rf_pred), 3)
    rf_mae = round(mean_absolute_error(y_test, rf_pred), 1)

    # Cross-validation (only if enough data)
    rf_cv_r2 = None
    if len(X) >= 10:
        cv_scores = cross_val_score(rf_pipeline, X, y, cv=min(5, len(X)), scoring="r2")
        rf_cv_r2 = round(cv_scores.mean(), 3)

    # ── Linear Regression (baseline for comparison) ──
    lr_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("lr", LinearRegression()),
    ])
    lr_pipeline.fit(X_train, y_train)
    lr_pred = lr_pipeline.predict(X_test)
    lr_r2 = round(r2_score(y_test, lr_pred), 3)
    lr_mae = round(mean_absolute_error(y_test, lr_pred), 1)

    # ── Feature Importance ──
    rf_model = rf_pipeline.named_steps["rf"]
    importances = rf_model.feature_importances_
    total = sum(importances)
    factor_importance = []
    for i, col in enumerate(factor_cols):
        factor_key = col.replace("Factor_", "")
        factor_importance.append({
            "factor": factor_key,
            "name": FACTOR_NAMES.get(factor_key, factor_key),
            "importance_pct": round((importances[i] / total) * 100, 1) if total > 0 else 0,
        })

    # Sort by importance descending
    factor_importance.sort(key=lambda x: x["importance_pct"], reverse=True)

    # Improvement calculation
    improvement = round(((rf_r2 - lr_r2) / max(abs(lr_r2), 0.01)) * 100, 1) if lr_r2 != 0 else 0

    return {
        "status": "success",
        "model_metrics": {
            "random_forest": {"r2": rf_r2, "mae": rf_mae, "cross_val_r2": rf_cv_r2},
            "linear_regression": {"r2": lr_r2, "mae": lr_mae},
            "improvement": f"RF improves R² by {improvement}% over linear baseline",
        },
        "factor_importance": factor_importance,
        "rf_pipeline": rf_pipeline,
        "factor_cols": factor_cols,
    }


# ─── Phase 3: Recommendation Generation ────────────────────────────────

def generate_recommendations(factor_importance: List[Dict]) -> List[Dict[str, Any]]:
    """Generate actionable recommendations based on top factor importance."""
    recommendations = []

    for fi in factor_importance:
        factor = fi["factor"]
        pct = fi["importance_pct"]

        # Only generate recommendations for factors with meaningful importance
        if factor in RECOMMENDATION_MAP:
            rec = RECOMMENDATION_MAP[factor].copy()
            rec["factor"] = factor
            rec["importance_pct"] = pct

            # Adjust severity based on importance percentage
            if pct >= 30:
                rec["severity"] = "critical"
            elif pct >= 15:
                rec["severity"] = "warning"
            else:
                rec["severity"] = "info"

            # Only include factors with > 3% importance
            if pct > 3:
                recommendations.append(rec)

    return recommendations


# ─── Public API Functions ───────────────────────────────────────────────

def get_overall_insights(db: Session, force_retrain: bool = False, teacher_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Get global ML insights across all modules.
    Uses cached model unless retrain is needed.
    If teacher_id is provided, only includes that teacher's modules.
    """
    cache_key = f"global_{teacher_id}" if teacher_id else "global"
    if not force_retrain and not _should_retrain(db, "global") and _model_cache.get("global") and cache_key == "global":
        return _model_cache["global"]

    df = build_dataset(db, teacher_id=teacher_id)
    if df.empty:
        return {
            "status": "no_data",
            "message": "No data available. Students need to complete both surveys and attend sessions.",
            "students_analyzed": 0,
            "modules_analyzed": 0,
            "overall_attendance": 0,
            "at_risk_count": 0,
        }

    result = train_and_analyze(df)

    if result["status"] != "success":
        return result

    # Remove non-serializable pipeline from response
    rf_pipeline = result.pop("rf_pipeline", None)
    result.pop("factor_cols", None)

    # Add summary stats
    result["students_analyzed"] = int(df["student_id"].nunique())
    result["modules_analyzed"] = int(df["module_code"].nunique())
    result["overall_attendance"] = round(float(df["attendance_pct"].mean()), 1)
    result["at_risk_count"] = int((df.groupby("student_id")["attendance_pct"].mean() < 80).sum())
    result["top_barrier_factor"] = result["factor_importance"][0]["name"] if result.get("factor_importance") else "N/A"
    result["recommendations"] = generate_recommendations(result["factor_importance"])
    result["last_trained_at"] = datetime.now().isoformat()

    # Per-module attendance breakdown
    module_attendance = []
    for mod_code in df["module_code"].unique():
        mod_df = df[df["module_code"] == mod_code]
        mod_name = mod_df["module_name"].iloc[0] if "module_name" in mod_df.columns else mod_code
        avg_att = round(float(mod_df["attendance_pct"].mean()), 1)
        student_count = int(mod_df["student_id"].nunique())
        at_risk = int((mod_df.groupby("student_id")["attendance_pct"].mean() < 80).sum())
        module_attendance.append({
            "module_code": mod_code,
            "module_name": mod_name,
            "average_attendance": avg_att,
            "student_count": student_count,
            "at_risk_count": at_risk,
        })
    module_attendance.sort(key=lambda x: x["average_attendance"])
    result["module_attendance"] = module_attendance

    # Cache the result
    _model_cache["global"] = result
    _update_cache_metadata(db)

    return result


def get_module_insights(db: Session, module_code: str, teacher_id: Optional[int] = None) -> Dict[str, Any]:
    """Get ML insights for a specific module."""
    cache_key = module_code

    if not _should_retrain(db, cache_key) and cache_key in _model_cache["modules"]:
        return _model_cache["modules"][cache_key]

    df = build_dataset(db, module_code=module_code, teacher_id=teacher_id)
    if df.empty:
        return {
            "status": "no_data",
            "module_code": module_code,
            "message": f"No data available for module {module_code}.",
        }

    result = train_and_analyze(df)

    if result["status"] != "success":
        result["module_code"] = module_code
        return result

    # Remove non-serializable objects
    rf_pipeline = result.pop("rf_pipeline", None)
    factor_cols = result.pop("factor_cols", None)

    # Module-specific info
    result["module_code"] = module_code
    result["module_name"] = df["module_name"].iloc[0] if "module_name" in df.columns else module_code
    result["students_in_module"] = int(df["student_id"].nunique())
    result["average_attendance"] = round(float(df["attendance_pct"].mean()), 1)
    result["recommendations"] = generate_recommendations(result["factor_importance"])

    # At-risk students (below 80%)
    at_risk = []
    for sid in df["student_id"].unique():
        student_df = df[df["student_id"] == sid]
        avg_att = student_df["attendance_pct"].mean()
        if avg_att < 80:
            # Find top barrier (highest factor score)
            factor_scores = {}
            for f in ["A", "B", "C", "D", "E", "F"]:
                col = f"Factor_{f}"
                val = student_df[col].iloc[0]
                if val is not None:
                    factor_scores[f] = float(val)

            top_barrier = max(factor_scores, key=factor_scores.get) if factor_scores else "N/A"

            at_risk.append({
                "student_id": sid,
                "attendance_pct": round(float(avg_att), 1),
                "top_barrier": f"Factor {top_barrier} ({FACTOR_NAMES.get(top_barrier, '')})",
                "barrier_score": round(factor_scores.get(top_barrier, 0), 1),
            })

    at_risk.sort(key=lambda x: x["attendance_pct"])
    result["at_risk_students"] = at_risk

    # Cache
    _model_cache["modules"][cache_key] = result

    return result


def get_student_insights(db: Session, student_user_id: int) -> Dict[str, Any]:
    """Get individual student factor profile and personalized recommendations."""

    # Get student reg number from user_id
    reg_row = db.execute(
        text("SELECT student_id FROM student_profiles WHERE user_id = :uid LIMIT 1"),
        {"uid": student_user_id},
    ).fetchone()

    if not reg_row:
        return {"status": "error", "message": "Student profile not found."}

    student_reg_no = reg_row[0]

    # Get latest survey answers
    survey_query = text("""
        SELECT sa.question_code, sa.value
        FROM survey_submissions ss
        JOIN survey_answers sa ON sa.submission_id = ss.id
        WHERE ss.student_reg_no = :reg_no
        AND ss.id = (
            SELECT MAX(id) FROM survey_submissions WHERE student_reg_no = :reg_no
        )
    """)
    answer_rows = db.execute(survey_query, {"reg_no": student_reg_no}).fetchall()

    if not answer_rows:
        return {
            "status": "no_survey",
            "student_id": student_reg_no,
            "message": "This student has not completed the survey yet.",
        }

    # Compute factor scores
    answers = {row[0]: row[1] for row in answer_rows}
    factor_scores = _compute_factor_scores_from_answers(answers)

    # Build factor profile with levels
    factor_profile = {}
    for f_key, score in factor_scores.items():
        if score is not None:
            if score >= 4.0:
                level = "high"
            elif score >= 3.0:
                level = "moderate"
            else:
                level = "low"
        else:
            level = "unknown"

        factor_profile[f_key] = {
            "name": FACTOR_NAMES.get(f_key, f_key),
            "score": score,
            "level": level,
        }

    # Get attendance per module
    att_query = text("""
        SELECT
            asess.module_code,
            asess.module_name,
            COUNT(ar.id) AS attended,
            (SELECT COUNT(*) FROM attendance_sessions a2 WHERE a2.module_code = asess.module_code) AS total
        FROM attendance_records ar
        JOIN attendance_sessions asess ON asess.session_id = ar.session_id
        WHERE ar.student_id = :sid
        GROUP BY asess.module_code, asess.module_name
    """)
    att_rows = db.execute(att_query, {"sid": student_reg_no}).fetchall()

    modules = []
    for att_row in att_rows:
        total = att_row[3]
        if total > 0:
            att_pct = round((att_row[2] / total) * 100, 1)
        else:
            att_pct = 0

        # Find top barrier for this student
        top_barrier_key = max(
            factor_scores,
            key=lambda k: factor_scores[k] if factor_scores[k] is not None else 0,
        )

        modules.append({
            "module_code": att_row[0],
            "module_name": att_row[1],
            "actual_attendance": att_pct,
            "top_barrier": f"Factor {top_barrier_key} ({FACTOR_NAMES.get(top_barrier_key, '')})",
        })

    # Personalized recommendations based on high factor scores
    personalized_recs = []
    sorted_factors = sorted(
        factor_scores.items(),
        key=lambda x: x[1] if x[1] is not None else 0,
        reverse=True,
    )
    for f_key, score in sorted_factors[:3]:
        if score is not None and score >= 3.0:
            name = FACTOR_NAMES.get(f_key, f_key)
            level = "High" if score >= 4.0 else "Moderate"
            personalized_recs.append(
                f"{level} {name.lower()} barriers ({score}/5)"
            )
            if f_key in RECOMMENDATION_MAP:
                actions = RECOMMENDATION_MAP[f_key]["actions"]
                if actions:
                    personalized_recs.append(f"  → {actions[0]}")

    return {
        "status": "success",
        "student_id": student_reg_no,
        "factor_profile": factor_profile,
        "modules": modules,
        "personalized_recommendations": personalized_recs,
    }


def force_retrain():
    """Clear model cache to force retraining on next request."""
    _model_cache["global"] = None
    _model_cache["modules"] = {}
    _model_cache["last_trained_at"] = None
    _model_cache["submission_count_at_training"] = 0
    logger.info("Model cache cleared — will retrain on next request")
