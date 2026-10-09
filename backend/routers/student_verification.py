from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.student import Student
from backend.models.student_verification import StudentVerification
from backend.schemas.student_verification import VerificationRequest, VerificationResponse
from backend.services.student_verification_service import verify_student, enroll_student_face, check_face_validity

router = APIRouter(prefix="/verification", tags=["Student Verification"])


@router.post("/check-face")
def validate_face_image(payload: dict, db: Session = Depends(get_db)):
    image_base64 = payload.get("image_base64")
    student_id = payload.get("student_id")
    if not image_base64:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing image_base64")
    return check_face_validity(db, image_base64, student_id=student_id)



@router.post("/verify", response_model=VerificationResponse)
def verify_student_live(payload: VerificationRequest, db: Session = Depends(get_db)):
    result = verify_student(db, payload.student_id, payload.image_base64)
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
    return result


@router.post("/enroll/{student_id}")
def enroll_student_face_endpoint(student_id: int, payload: dict, db: Session = Depends(get_db)):
    image_base64 = payload.get("image_base64")
    if not image_base64:
        raise HTTPException(status_code=400, detail="Missing image_base64")
    result = enroll_student_face(db, student_id, image_base64)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


@router.get("/history")
def get_verification_history(limit: int = 50, db: Session = Depends(get_db)):
    records = db.query(StudentVerification).order_by(StudentVerification.verified_at.desc()).limit(limit).all()
    out = []
    for r in records:
        student = db.query(Student).filter(Student.id == r.student_id).first()
        out.append({
            "id": r.id,
            "student_id": r.student_id,
            "student_name": student.name if student else "Unknown",
            "roll_number": student.roll_number if student else "N/A",
            "status": r.status,
            "confidence": r.confidence,
            "notes": r.notes,
            "verified_at": r.verified_at
        })
    return out
