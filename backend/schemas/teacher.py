from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class TeacherBase(BaseModel):
    name: str
    email: EmailStr
    department: str = "Computer Science & Engineering"
    subject: str = "Deep Learning & Computer Vision"
    designation: Optional[str] = "Associate Professor & Lab Lead"
    employee_id: Optional[str] = "EMP-CS-2024"
    phone: Optional[str] = "+91 98450 11223"
    office_room: Optional[str] = "Faculty Block B - Room 304"
    bio: Optional[str] = "Specializing in Computer Vision, Facial Biometrics, and Deep Learning Neural Architectures."
    photo_url: Optional[str] = None


class TeacherCreate(TeacherBase):
    password: str


class TeacherUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    department: Optional[str] = None
    subject: Optional[str] = None
    designation: Optional[str] = None
    employee_id: Optional[str] = None
    phone: Optional[str] = None
    office_room: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    password: Optional[str] = None


class TeacherLogin(BaseModel):
    email: EmailStr
    password: str


class TeacherResponse(TeacherBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
