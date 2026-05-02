from typing import List, Optional
from pydantic import BaseModel, Field


class SurveyAnswerIn(BaseModel):
    question_code: str = Field(..., min_length=1, max_length=10)
    value: int = Field(..., ge=1, le=5)


class SurveySubmitIn(BaseModel):
    remark: Optional[str] = None
    answers: List[SurveyAnswerIn] = Field(default_factory=list)
