from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .survey import (
    init_survey_tables,
    save_survey_submission,
    get_latest_survey_by_user_id,
    get_student_modules,
    get_survey_completion_status,
)

# get_db import
try:
    from modules.database import get_db  # type: ignore
except Exception:
    from database import get_db  # type: ignore

# auth dependency
try:
    from modules.auth.dependencies import get_current_user  # type: ignore
except Exception:
    from modules.auth.auth_utils import get_current_user  # type: ignore


# IMPORTANT: NO "/api" here — main.py adds "/api" when including routers
router = APIRouter(prefix="/attendance", tags=["Attendance Survey"])

_SURVEY_READY = False


def ensure_survey_ready(db: Session):
    global _SURVEY_READY
    if not _SURVEY_READY:
        init_survey_tables(db)
        _SURVEY_READY = True


def _current_user_id(user) -> int:
    uid = getattr(user, "id", None)
    if uid is None:
        raise HTTPException(status_code=401, detail="Invalid user session")
    return int(uid)


@router.get("/survey/me/latest")
def my_latest_survey(
    module_code: str = Query(None, description="Module code for per-module survey"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_survey_ready(db)
    user_id = _current_user_id(user)
    return get_latest_survey_by_user_id(db, user_id, module_code=module_code)


@router.get("/survey/me/modules")
def my_survey_modules(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    Get student's enrolled modules and survey completion status.
    Returns the list of modules (from attendance records) and which ones
    have completed surveys.
    """
    ensure_survey_ready(db)
    user_id = _current_user_id(user)
    return get_survey_completion_status(db, user_id)


@router.post("/survey/submit")
def submit_survey(payload: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    Accepts payload like:
    {
      "remark": "text or null",
      "module_code": "IT3011" or null,
      "answers": [{"question_code":"A1","value":5}, ...]
    }
    module_code = null -> global survey (A,B factors)
    module_code = "IT3011" -> per-module survey (C,D,E,F factors)
    """
    ensure_survey_ready(db)
    user_id = _current_user_id(user)

    answers = payload.get("answers", [])
    remark = payload.get("remark", None)
    module_code = payload.get("module_code", None)

    if not answers:
        raise HTTPException(status_code=400, detail="No answers provided")

    try:
        result = save_survey_submission(
            db=db,
            user_id=user_id,
            remark=remark,
            answers_list=answers,
            module_code=module_code,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save survey: {str(e)}")
