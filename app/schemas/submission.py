from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.db.models import VerdictEnum

class SubmissionBase(BaseModel):
    problem_id: int
    code: str
    language: str = "cpp"

class SubmissionCreate(SubmissionBase):
    pass

class SubmissionResponse(SubmissionBase):
    id: int
    user_id: int
    verdict: VerdictEnum
    execution_time: Optional[float] = None
    memory_used: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True