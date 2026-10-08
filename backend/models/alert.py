from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    alert_type = Column(String(50), default="INATTENTIVE")  # INATTENTIVE, LOOKING_AWAY, SLEEPING, ABSENT
    attentiveness_score = Column(Float, default=0.0)
    message = Column(Text, nullable=False)
    email_sent_to = Column(String(255), nullable=True)
    status = Column(String(50), default="SENT")  # SENT, FAILED, QUEUED
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="alerts")
