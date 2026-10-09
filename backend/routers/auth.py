from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.teacher import Teacher
from backend.schemas.teacher import TeacherCreate, TeacherLogin, TeacherResponse, TeacherUpdate
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
        designation=payload.designation or "Associate Professor & Lab Lead",
        employee_id=payload.employee_id or "EMP-CS-2024",
        phone=payload.phone or "+91 98450 11223",
        office_room=payload.office_room or "Faculty Block B - Room 304",
        bio=payload.bio or "Specializing in Computer Vision, Facial Biometrics, and Deep Learning Neural Architectures.",
        photo_url=payload.photo_url,
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
            "subject": teacher.subject,
            "designation": teacher.designation or "Associate Professor & Lab Lead",
            "employee_id": teacher.employee_id or "EMP-CS-2024",
            "phone": teacher.phone or "+91 98450 11223",
            "office_room": teacher.office_room or "Faculty Block B - Room 304",
            "bio": teacher.bio or "Specializing in Computer Vision, Facial Biometrics, and Deep Learning Neural Architectures.",
            "photo_url": teacher.photo_url
        }
    }


@router.get("/me", response_model=TeacherResponse)
def get_current_user_profile(teacher_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Teacher)
    if teacher_id:
        teacher = query.filter(Teacher.id == teacher_id).first()
    else:
        teacher = query.first()

    if not teacher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher profile not found")
    return teacher


@router.put("/profile", response_model=TeacherResponse)
def update_teacher_profile(payload: TeacherUpdate, teacher_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Teacher)
    if teacher_id:
        teacher = query.filter(Teacher.id == teacher_id).first()
    else:
        teacher = query.first()

    if not teacher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")

    update_data = payload.dict(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        teacher.password_hash = get_password_hash(update_data.pop("password"))
    elif "password" in update_data:
        update_data.pop("password")

    for key, val in update_data.items():
        if hasattr(teacher, key) and val is not None:
            setattr(teacher, key, val)

    db.commit()
    db.refresh(teacher)
    return teacher
