from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.teacher import Teacher
from backend.schemas.teacher import TeacherCreate, TeacherLogin, TeacherResponse
from backend.services.auth_service import verify_password, get_password_hash, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TeacherResponse)
def register_teacher(payload: TeacherCreate, db: Session = Depends(get_db)):
    existing = db.query(Teacher).filter(Teacher.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A teacher with this email is already registered."
        )

    teacher = Teacher(
        name=payload.name,
        email=payload.email,
        department=payload.department,
        subject=payload.subject,
        password_hash=get_password_hash(payload.password)
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return teacher


@router.post("/login")
def login(payload: TeacherLogin, db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(Teacher.email == payload.email).first()
    if not teacher or not verify_password(payload.password, teacher.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    access_token = create_access_token(data={"sub": teacher.email, "id": teacher.id, "name": teacher.name})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": teacher.id,
            "name": teacher.name,
            "email": teacher.email,
            "department": teacher.department,
            "subject": teacher.subject
        }
    }


@router.get("/me")
def get_current_user_profile(db: Session = Depends(get_db)):
    # Returns default teacher info or demo profile
    teacher = db.query(Teacher).first()
    if not teacher:
        return {
            "id": 1,
            "name": "Prof. Alan Turing",
            "email": "turing@smartclass.edu",
            "department": "Computer Science & AI",
            "subject": "Deep Learning & Computer Vision"
        }
    return {
        "id": teacher.id,
        "name": teacher.name,
        "email": teacher.email,
        "department": teacher.department,
        "subject": teacher.subject
    }
