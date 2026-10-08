from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.alert import Alert
from backend.models.student import Student
from backend.schemas.alert import (
    AlertResponse,
    EmailConfigTestRequest,
    SMTPConfigUpdate,
    SMTPConfigResponse
)
from backend.services.email_service import (
    send_inattention_alert_email,
    get_smtp_config_safe,
    save_smtp_config
)

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=List[AlertResponse])
def get_alerts(
    limit: int = 50,
    student_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Alert)
    if student_id:
        query = query.filter(Alert.student_id == student_id)

    alerts = query.order_by(Alert.created_at.desc()).limit(limit).all()

    result = []
    for a in alerts:
        student = db.query(Student).filter(Student.id == a.student_id).first() if a.student_id else None
        result.append(AlertResponse(
            id=a.id,
            student_id=a.student_id,
            student_name=student.name if student else "Enrolled Student",
            student_roll=student.roll_number if student else "N/A",
            alert_type=a.alert_type,
            attentiveness_score=a.attentiveness_score,
            message=a.message,
            email_sent_to=a.email_sent_to,
            status=a.status,
            created_at=a.created_at
        ))
    return result


@router.get("/smtp_config", response_model=SMTPConfigResponse)
def get_smtp_settings():
    """Retrieve current SMTP configuration status and details (password masked)"""
    return get_smtp_config_safe()


@router.post("/smtp_config", response_model=SMTPConfigResponse)
def update_smtp_settings(payload: SMTPConfigUpdate):
    """Update and persist SMTP configuration into runtime and .env"""
    updated = save_smtp_config(
        host=payload.host,
        port=payload.port,
        user=payload.user,
        password=payload.password,
        from_email=payload.from_email,
        enabled=payload.enabled
    )
    return updated


@router.post("/test_email")
def test_email_configuration(payload: EmailConfigTestRequest):
    """Send a diagnostic test email to verify SMTP configuration"""
    res = send_inattention_alert_email(
        student_name="Test Student",
        student_email=payload.recipient_email,
        parent_email=None,
        lecture_title="Diagnostic System Check",
        attentiveness_pct=62.5,
        reason="Diagnostic Test (Looking Away)",
        detected_time="Just Now"
    )
    return res
