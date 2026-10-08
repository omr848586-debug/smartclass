from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class StudentBase(BaseModel):
    roll_number: str
    name: str
    email: EmailStr
    parent_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    department: str = "Computer Science"
    section: str = "A"
    year: str = "3rd Year"
    photo_url: Optional[str] = None


class StudentCreate(StudentBase):
    face_encoding: Optional[str] = None


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    parent_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    section: Optional[str] = None
    year: Optional[str] = None
    photo_url: Optional[str] = None
    face_encoding: Optional[str] = None


class StudentResponse(StudentBase):
    id: int
    has_face_enrolled: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
