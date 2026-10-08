from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from backend.database import Base


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    lecture_title = Column(String(150), default="Live Class Lecture")
    session_id = Column(String(100), index=True, nullable=False)
    source_type = Column(String(50), default="WEBCAM")  # WEBCAM, RTSP, GOOGLE_MEET
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)
    total_frames = Column(Integer, default=0)
    attentive_frames = Column(Integer, default=0)
    attentiveness_percentage = Column(Float, default=0.0)
    attendance_status = Column(String(50), default="PRESENT")  # PRESENT, WARNING, ABSENT
    alert_count = Column(Integer, default=0)
    email_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="attendance_records")
