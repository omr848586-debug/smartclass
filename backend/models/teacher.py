from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from backend.database import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    department = Column(String(100), nullable=False, default="Computer Science")
    subject = Column(String(100), nullable=False, default="Artificial Intelligence")
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
