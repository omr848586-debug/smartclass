from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text
from backend.database import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    department = Column(String(100), nullable=False, default="Computer Science & Engineering")
    subject = Column(String(100), nullable=False, default="Deep Learning & Computer Vision")
    designation = Column(String(100), nullable=True, default="Associate Professor & Lab Lead")
    employee_id = Column(String(50), nullable=True, default="EMP-CS-2024")
    phone = Column(String(50), nullable=True, default="+91 98450 11223")
    office_room = Column(String(100), nullable=True, default="Faculty Block B - Room 304")
    bio = Column(Text, nullable=True, default="Specializing in Computer Vision, Facial Biometrics, and Deep Learning Neural Architectures.")
    photo_url = Column(Text, nullable=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
