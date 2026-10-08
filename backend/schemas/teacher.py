from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class TeacherBase(BaseModel):
    name: str
    email: EmailStr
    department: str = "Computer Science"
    subject: str = "Artificial Intelligence"


class TeacherCreate(TeacherBase):
    password: str


class TeacherLogin(BaseModel):
    email: EmailStr
    password: str


class TeacherResponse(TeacherBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
