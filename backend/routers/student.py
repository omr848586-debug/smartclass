from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.student import Student
from backend.schemas.student import StudentCreate, StudentUpdate, StudentResponse
from backend.services.student_verification_service import enroll_student_face

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("", response_model=List[StudentResponse])
def get_all_students(
    department: Optional[str] = None,
    section: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Student)
    if department:
        query = query.filter(Student.department == department)
    if section:
        query = query.filter(Student.section == section)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Student.name.ilike(search_pattern)) | (Student.roll_number.ilike(search_pattern))
        )

    students = query.order_by(Student.roll_number).all()
    # Populate has_face_enrolled computed field
    result = []
    for s in students:
        resp = StudentResponse(
            id=s.id,
            roll_number=s.roll_number,
            name=s.name,
            email=s.email,
            parent_email=s.parent_email,
            phone=s.phone,
            department=s.department,
            section=s.section,
            year=s.year,
            photo_url=s.photo_url,
            has_face_enrolled=bool(s.face_encoding),
            created_at=s.created_at
        )
        result.append(resp)
    return result


@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def create_student(payload: StudentCreate, db: Session = Depends(get_db)):
    existing = db.query(Student).filter(Student.roll_number == payload.roll_number).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Student with roll number '{payload.roll_number}' already exists."
        )

    student = Student(
        roll_number=payload.roll_number,
        name=payload.name,
        email=payload.email,
        parent_email=payload.parent_email,
        phone=payload.phone,
        department=payload.department,
        section=payload.section,
        year=payload.year,
        photo_url=payload.photo_url,
        face_encoding=payload.face_encoding
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    # If photo provided, automatically enroll face and enforce unique face constraint
    if payload.photo_url:
        enroll_res = enroll_student_face(db, student.id, payload.photo_url)
        if not enroll_res.get("success"):
            db.delete(student)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=enroll_res.get("message", "Failed to enroll face photo.")
            )

    return StudentResponse(
        id=student.id,
        roll_number=student.roll_number,
        name=student.name,
        email=student.email,
        parent_email=student.parent_email,
        phone=student.phone,
        department=student.department,
        section=student.section,
        year=student.year,
        photo_url=student.photo_url,
        has_face_enrolled=bool(student.face_encoding),
        created_at=student.created_at
    )


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    return StudentResponse(
        id=student.id,
        roll_number=student.roll_number,
        name=student.name,
        email=student.email,
        parent_email=student.parent_email,
        phone=student.phone,
        department=student.department,
        section=student.section,
        year=student.year,
        photo_url=student.photo_url,
        has_face_enrolled=bool(student.face_encoding),
        created_at=student.created_at
    )


@router.put("/{student_id}", response_model=StudentResponse)
def update_student(student_id: int, payload: StudentUpdate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        if key != "photo_url":
            setattr(student, key, value)

    if payload.photo_url:
        enroll_res = enroll_student_face(db, student.id, payload.photo_url)
        if not enroll_res.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=enroll_res.get("message", "Failed to update face photo.")
            )

    db.commit()
    db.refresh(student)

    return StudentResponse(
        id=student.id,
        roll_number=student.roll_number,
        name=student.name,
        email=student.email,
        parent_email=student.parent_email,
        phone=student.phone,
        department=student.department,
        section=student.section,
        year=student.year,
        photo_url=student.photo_url,
        has_face_enrolled=bool(student.face_encoding),
        created_at=student.created_at
    )


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    db.delete(student)
    db.commit()
    return None
