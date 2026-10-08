from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class VerificationRequest(BaseModel):
    student_id: int
    image_base64: str


class VerificationResponse(BaseModel):
    student_id: int
    student_name: str
    roll_number: str
    verified: bool
    confidence: float
    message: str
    verified_at: datetime
