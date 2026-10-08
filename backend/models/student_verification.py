from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base


class StudentVerification(Base):
    __tablename__ = "student_verifications"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    status = Column(String(50), default="VERIFIED")  # VERIFIED, UNVERIFIED, MISMATCH
    confidence = Column(Float, default=1.0)
    verification_photo = Column(Text, nullable=True)
    notes = Column(String(255), nullable=True)
    verified_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="verifications")
