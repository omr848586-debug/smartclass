from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from backend.database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    roll_number = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(120), nullable=False)
    parent_email = Column(String(120), nullable=True)
    phone = Column(String(20), nullable=True)
    department = Column(String(100), nullable=False, default="Computer Science")
    section = Column(String(20), nullable=False, default="A")
    year = Column(String(20), nullable=False, default="3rd Year")
    photo_url = Column(Text, nullable=True)
    face_encoding = Column(Text, nullable=True)  # JSON landmark vector for matching
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    verifications = relationship("StudentVerification", back_populates="student", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="student", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="student", cascade="all, delete-orphan")
