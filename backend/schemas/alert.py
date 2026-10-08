from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class AlertCreate(BaseModel):
    student_id: Optional[int] = None
    alert_type: str = "INATTENTIVE"
    attentiveness_score: float = 0.0
    message: str
    email_sent_to: Optional[str] = None


class AlertResponse(BaseModel):
    id: int
    student_id: Optional[int]
    student_name: Optional[str] = None
    student_roll: Optional[str] = None
    alert_type: str
    attentiveness_score: float
    message: str
    email_sent_to: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class EmailConfigTestRequest(BaseModel):
    recipient_email: EmailStr


class SMTPConfigUpdate(BaseModel):
    host: str = "smtp.gmail.com"
    port: int = 587
    user: str
    password: Optional[str] = None
    from_email: Optional[str] = None
    enabled: bool = True


class SMTPConfigResponse(BaseModel):
    host: str
    port: int
    user: str
    from_email: str
    enabled: bool
    has_password: bool

