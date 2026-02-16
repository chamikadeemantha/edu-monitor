from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .survey import (
    init_survey_tables,
    save_survey_submission,
    get_latest_survey_by_user_id,
)

# ✅ get_db import (keep your working one)
try:
    from modules.database import get_db  # type: ignore
except Exception:
    from database import get_db  # type: ignore

# ✅ auth dependency (use the one your project already uses)
try:
    from modules.auth.dependencies import get_current_user  # type: ignore
except Exception:
    from modules.auth.auth_utils import get_current_user  # type: ignore


# ✅ IMPORTANT: NO "/api" here
# main.py usually adds "/api" when including routers
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
def my_latest_survey(db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_survey_ready(db)
    user_id = _current_user_id(user)
    return get_latest_survey_by_user_id(db, user_id)


@router.post("/survey/submit")
def submit_survey(payload: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    Accepts payload like:
    {
      "remark": "text or null",
      "answers": [{"question_code":"A1","value":5}, ...]
    }
    """
    ensure_survey_ready(db)
    user_id = _current_user_id(user)

    answers = payload.get("answers", [])
    remark = payload.get("remark", None)

    if not answers:
        raise HTTPException(status_code=400, detail="No answers provided")

    try:
        result = save_survey_submission(
            db=db,
            user_id=user_id,
            remark=remark,
            answers_list=answers,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save survey: {str(e)}")
