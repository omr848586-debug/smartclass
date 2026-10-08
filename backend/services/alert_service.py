from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from backend.models.alert import Alert
from backend.models.student import Student
from backend.services.email_service import send_inattention_alert_email


def trigger_inattention_alert(
    db: Session,
    student_id: Optional[int],
    lecture_title: str,
    attentiveness_score: float,
    reason: str
) -> Optional[Alert]:
    """
    Create an Alert entry in the database and dispatch an automatic email
    to the student and parent.
    """
    student = db.query(Student).filter(Student.id == student_id).first() if student_id else None

    student_name = student.name if student else "Enrolled Student"
    student_email = student.email if student else "student@smartclass.edu"
    parent_email = student.parent_email if student else None

    # Send email
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    email_result = send_inattention_alert_email(
        student_name=student_name,
        student_email=student_email,
        parent_email=parent_email,
        lecture_title=lecture_title,
        attentiveness_pct=attentiveness_score,
        reason=reason,
        detected_time=now_str
    )

    alert_msg = f"Inattention detected ({reason}). Attentiveness: {attentiveness_score:.1f}%. {email_result.get('message', '')}"
    recipient_summary = ", ".join(email_result.get("recipients", [student_email]))

    alert = Alert(
        student_id=student.id if student else None,
        alert_type="INATTENTIVE",
        attentiveness_score=attentiveness_score,
        message=alert_msg,
        email_sent_to=recipient_summary,
        status=email_result.get("status", "SENT"),
        created_at=datetime.utcnow()
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert
