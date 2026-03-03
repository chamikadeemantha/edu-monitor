"""
ML Insights Engine -- Core data pipeline, model training, and recommendation generation.

Reads existing survey + attendance data, trains Ridge Regression model
(validated as best performer with real data: CV R2 = 0.8662),
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
from sklearn.linear_model import LinearRegression, RidgeCV
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
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
# Grounded in educational research literature:
#   - Universal Design for Learning (CAST, 2018)
#   - Tinto's Student Integration Model (1975, 1993)
#   - Bandura's Self-Efficacy Theory (1997)
#   - Vygotsky's Social Learning Theory (1978)
#   - Herzberg's Two-Factor Theory applied to education (DeShields et al., 2005)
#   - Chronobiology & class scheduling research (Kelley et al., 2015)
# ────────────────────────────────────────────────────────────────────────

RECOMMENDATION_MAP: Dict[str, Dict[str, Any]] = {
    "F": {
        "severity": "critical",
        "title": "Scheduling Conflicts Are the #1 Barrier",
        "description": "Timetable clashes and poorly timed sessions significantly reduce attendance.",
        "actions": [
            "Audit timetable for clashes with other high-enrollment modules in the same cohort",
            "Shift sessions away from early morning and late evening slots — cognitive performance peaks mid-morning",
            "Avoid scheduling sessions during assessment-heavy weeks; coordinate with exam office",
            "Offer recorded lecture access for genuinely conflicted students as a blended approach",
            "Distribute contact hours across the week rather than clustering on one day",
        ],
    },
    "A": {
        "severity": "warning",
        "title": "Health & Well-Being Issues Are Significant",
        "description": "Physical and mental health barriers strongly predict absenteeism.",
        "actions": [
            "Implement mandatory 10-minute breaks in sessions over 90 minutes",
            "Create a clear medical absence policy with make-up options, not rigid penalties",
            "Integrate brief well-being check-ins at the start of tutorials to identify struggling students early",
            "Share institutional counseling and mental health resources proactively",
            "Provide multiple means of engagement for students with chronic health barriers",
        ],
    },
    "E": {
        "severity": "info",
        "title": "Academic Engagement Boosts Attendance",
        "description": "Students who rate teaching quality higher attend significantly more. Active learning increases attendance.",
        "actions": [
            "Replace passive lectures with active learning techniques like polls, quizzes, and discussions",
            "Use the flipped classroom model: pre-recorded content plus in-class problem-solving",
            "Connect every session to career or real-world applications so students see relevance",
            "Collect mid-semester teaching feedback and visibly act on it",
            "Academic engagement is your strongest lever to improve attendance — strengthen it",
        ],
    },
    "B": {
        "severity": "info",
        "title": "Self-Regulation & Motivation Challenges",
        "description": "Students with low self-regulation struggle with attendance consistency.",
        "actions": [
            "Implement a peer mentoring or study buddy system for social accountability",
            "Send automated session reminders 24 hours and 1 hour before class",
            "Break large assessments into smaller milestones with attendance-linked formative tasks",
            "Set explicit attendance goals with students at the start of the semester",
            "Provide a visible personal attendance dashboard so students can self-monitor",
        ],
    },
    "C": {
        "severity": "info",
        "title": "Peer & Social Influence Detected",
        "description": "Social dynamics significantly influence attendance decisions.",
        "actions": [
            "Create structured group projects that require in-person collaboration",
            "Assign mixed-attendance study groups to break negative peer influence patterns",
            "Foster classroom community through ice-breakers in the first 3 weeks — early belonging predicts retention",
            "Use collaborative in-class activities like think-pair-share and group problem-solving",
            "Identify socially isolated students early — they are most susceptible to peer-influenced absenteeism",
        ],
    },
    "D": {
        "severity": "info",
        "title": "Classroom Environment Matters",
        "description": "Physical environment factors affect student comfort and attendance decisions.",
        "actions": [
            "Report specific facility issues like temperature, ventilation, and seating problems",
            "Request room changes if the current space is too large or small for the cohort",
            "Experiment with flexible seating arrangements instead of traditional rows",
            "Ensure reliable classroom technology — projectors, Wi-Fi, power outlets",
            "For large lectures, rotate to smaller tutorial rooms periodically for a more intimate setting",
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

    Uses HYBRID survey model:
      - Factors A,B come from global survey (module_code IS NULL)
      - Factors C,D,E,F come from per-module survey (module_code = X) if available,
        otherwise falls back to global survey
    """
    # Step 1a: Get GLOBAL survey answers (A,B factors — or all factors for legacy data)
    global_query = text("""
        SELECT
            ss.student_reg_no,
            sa.question_code,
            sa.value
        FROM survey_submissions ss
        JOIN survey_answers sa ON sa.submission_id = ss.id
        WHERE ss.student_reg_no IS NOT NULL
        AND ss.id IN (
            SELECT MAX(id) FROM survey_submissions
            WHERE student_reg_no IS NOT NULL
            AND (module_code IS NULL OR module_code = '')
            GROUP BY student_reg_no
        )
        ORDER BY ss.student_reg_no, sa.question_code
    """)

    # Step 1b: Get PER-MODULE survey answers (C,D,E,F factors)
    module_survey_query = text("""
        SELECT
            ss.student_reg_no,
            ss.module_code,
            sa.question_code,
            sa.value
        FROM survey_submissions ss
        JOIN survey_answers sa ON sa.submission_id = ss.id
        WHERE ss.student_reg_no IS NOT NULL
        AND ss.module_code IS NOT NULL AND ss.module_code != ''
        AND ss.id IN (
            SELECT MAX(id) FROM survey_submissions
            WHERE student_reg_no IS NOT NULL
            AND module_code IS NOT NULL AND module_code != ''
            GROUP BY student_reg_no, module_code
        )
        ORDER BY ss.student_reg_no, ss.module_code, sa.question_code
    """)

    try:
        global_rows = db.execute(global_query).fetchall()
        module_survey_rows = db.execute(module_survey_query).fetchall()
    except Exception as e:
        logger.error(f"Failed to query survey data: {e}")
        return pd.DataFrame()

    if not global_rows and not module_survey_rows:
        logger.warning("No survey data found")
        return pd.DataFrame()

    # Group global answers by student
    student_global_answers: Dict[str, Dict[str, int]] = {}
    for row in global_rows:
        reg_no = row[0]
        q_code = row[1]
        value = row[2]
        if reg_no not in student_global_answers:
            student_global_answers[reg_no] = {}
        student_global_answers[reg_no][q_code] = value

    # Group per-module answers by (student, module)
    student_module_answers: Dict[str, Dict[str, Dict[str, int]]] = {}
    for row in module_survey_rows:
        reg_no = row[0]
        mod = row[1]
        q_code = row[2]
        value = row[3]
        if reg_no not in student_module_answers:
            student_module_answers[reg_no] = {}
        if mod not in student_module_answers[reg_no]:
            student_module_answers[reg_no][mod] = {}
        student_module_answers[reg_no][mod][q_code] = value

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

    # Step 3: Join — merge global (A,B) + per-module (C,D,E,F) factors with attendance
    rows = []
    for att_row in att_rows:
        student_id = att_row[0]
        mod_code = att_row[1]
        mod_name = att_row[2]
        attended = att_row[3]
        total = att_row[4]

        if total == 0:
            continue

        # Get global answers (A,B + possibly all for legacy)
        global_ans = student_global_answers.get(student_id, {})

        # Get per-module answers (C,D,E,F) if available
        module_ans = student_module_answers.get(student_id, {}).get(mod_code, {})

        # Merge: for each factor, prefer per-module data, fall back to global
        merged_answers = {}
        merged_answers.update(global_ans)        # Start with global (has A,B + legacy C-F)
        merged_answers.update(module_ans)         # Override C,D,E,F with per-module if available

        if not merged_answers:
            continue  # No survey data at all for this student

        # Compute factor scores from merged answers
        factors = _compute_factor_scores_from_answers(merged_answers)

        att_pct = round((attended / total) * 100, 1)

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
    Train Ridge Regression (primary) + Linear Regression (baseline) on factor scores.
    Ridge Regression was validated as best model with real data (CV R2 = 0.8662).
    Feature importance is derived from standardized coefficients.
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

    # == Ridge Regression (primary model — best CV R2 in real data) ==
    ridge_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("model", RidgeCV(alphas=np.logspace(-3, 3, 60))),
    ])
    ridge_pipeline.fit(X_train, y_train)
    ridge_pred = ridge_pipeline.predict(X_test)
    ridge_r2 = round(r2_score(y_test, ridge_pred), 4)
    ridge_mae = round(mean_absolute_error(y_test, ridge_pred), 2)

    # Cross-validation
    ridge_cv_r2 = None
    if len(X) >= 10:
        cv_scores = cross_val_score(ridge_pipeline, X, y, cv=min(5, len(X)), scoring="r2")
        ridge_cv_r2 = round(cv_scores.mean(), 4)

    # == Linear Regression (baseline for comparison) ==
    lr_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("lr", LinearRegression()),
    ])
    lr_pipeline.fit(X_train, y_train)
    lr_pred = lr_pipeline.predict(X_test)
    lr_r2 = round(r2_score(y_test, lr_pred), 4)
    lr_mae = round(mean_absolute_error(y_test, lr_pred), 2)

    # == Feature Importance from Ridge standardized coefficients ==
    # Since features are standardized, |coef| directly measures importance
    ridge_model = ridge_pipeline.named_steps["model"]
    coefs = np.abs(ridge_model.coef_)
    total = coefs.sum()
    factor_importance = []
    for i, col in enumerate(factor_cols):
        factor_key = col.replace("Factor_", "")
        raw_coef = ridge_model.coef_[i]  # Keep sign for direction info
        imp_pct = round((coefs[i] / total) * 100, 1) if total > 0 else 0
        factor_importance.append({
            "factor": factor_key,
            "name": FACTOR_NAMES.get(factor_key, factor_key),
            "importance_pct": imp_pct,
            "direction": "positive" if raw_coef > 0 else "negative",
        })

    # Sort by importance descending
    factor_importance.sort(key=lambda x: x["importance_pct"], reverse=True)

    return {
        "status": "success",
        "model_metrics": {
            "ridge_regression": {"r2": ridge_r2, "mae": ridge_mae, "cross_val_r2": ridge_cv_r2},
            "linear_regression": {"r2": lr_r2, "mae": lr_mae},
        },
        "factor_importance": factor_importance,
        "ridge_pipeline": ridge_pipeline,
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
    ridge_pipeline = result.pop("ridge_pipeline", None)
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
    ridge_pipeline = result.pop("ridge_pipeline", None)
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
