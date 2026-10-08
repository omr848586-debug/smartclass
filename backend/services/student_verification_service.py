import json
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.models.student import Student
from backend.models.student_verification import StudentVerification
from ai.student_verification import compute_face_features, compare_features, decode_base64_image


def enroll_student_face(db: Session, student_id: int, image_base64: str) -> Dict[str, Any]:
    """Enroll a student's facial profile with strict duplicate face prevention"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        return {"success": False, "message": "Student not found"}

    img = decode_base64_image(image_base64)
    if img is None:
        return {"success": False, "message": "Could not decode image"}

    features = compute_face_features(img)
    if not features:
        return {"success": False, "message": "No valid face features could be extracted from image"}

    # Strict check: Ensure face does not match ANY other enrolled student
    other_students = db.query(Student).filter(Student.id != student_id, Student.face_encoding.isnot(None)).all()
    for other in other_students:
        try:
            other_features = json.loads(other.face_encoding)
            is_match, conf = compare_features(features, other_features)
            if is_match and conf >= 0.80:
                # STRICT REJECTION: Reject and do not save
                return {
                    "success": False,
                    "duplicate": True,
                    "message": f"Biometric Conflict: This face is already enrolled for '{other.name}' ({other.roll_number}). Each face can only be stored once in the system."
                }
        except Exception:
            continue

    student.face_encoding = json.dumps(features)
    student.photo_url = image_base64
    db.commit()

    return {
        "success": True,
        "message": f"Face enrolled successfully for {student.name} ({student.roll_number})"
    }


def verify_student(db: Session, student_id: int, image_base64: str) -> Dict[str, Any]:
    """Verify a live capture against enrolled student face"""
    now = datetime.utcnow()
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        return {
            "student_id": student_id,
            "student_name": "Unknown",
            "roll_number": "N/A",
            "verified": False,
            "confidence": 0.0,
            "message": "Student record not found in database",
            "verified_at": now
        }

    # If student has no face profile enrolled yet, check for duplicates before enrolling
    if not student.face_encoding:
        live_img = decode_base64_image(image_base64)
        if live_img is not None:
            features = compute_face_features(live_img)
            if features:
                # Check for duplicates across all other students
                other_students = db.query(Student).filter(Student.id != student_id, Student.face_encoding.isnot(None)).all()
                for other in other_students:
                    try:
                        other_features = json.loads(other.face_encoding)
                        is_match, conf = compare_features(features, other_features)
                        if is_match and conf >= 0.80:
                            return {
                                "student_id": student.id,
                                "student_name": student.name,
                                "roll_number": student.roll_number,
                                "verified": False,
                                "confidence": conf,
                                "message": f"Enrollment Rejected: This face already belongs to '{other.name}' ({other.roll_number}).",
                                "verified_at": now
                            }
                    except Exception:
                        continue

                student.face_encoding = json.dumps(features)
                student.photo_url = image_base64
                db.commit()
                # Also save verified record
                record = StudentVerification(
                    student_id=student.id,
                    status="VERIFIED",
                    confidence=1.0,
                    verification_photo=image_base64[:500] if image_base64 else None,
                    notes="First-time enrollment & verification",
                    verified_at=now
                )
                db.add(record)
                db.commit()
                return {
                    "student_id": student.id,
                    "student_name": student.name,
                    "roll_number": student.roll_number,
                    "verified": True,
                    "confidence": 1.0,
                    "message": "First-time face successfully enrolled and verified!",
                    "verified_at": now
                }

        return {
            "student_id": student.id,
            "student_name": student.name,
            "roll_number": student.roll_number,
            "verified": False,
            "confidence": 0.0,
            "message": f"Student {student.name} does not have an enrolled face profile. Please provide a clear face photo.",
            "verified_at": now
        }

    live_img = decode_base64_image(image_base64)
    if live_img is None:
        return {
            "student_id": student.id,
            "student_name": student.name,
            "roll_number": student.roll_number,
            "verified": False,
            "confidence": 0.0,
            "message": "Invalid image format provided",
            "verified_at": now
        }

    live_features = compute_face_features(live_img)
    if not live_features:
        return {
            "student_id": student.id,
            "student_name": student.name,
            "roll_number": student.roll_number,
            "verified": False,
            "confidence": 0.0,
            "message": "No face detected in live photo. Please look straight at the camera.",
            "verified_at": now
        }

    try:
        enrolled_features = json.loads(student.face_encoding)
    except Exception:
        return {
            "student_id": student.id,
            "student_name": student.name,
            "roll_number": student.roll_number,
            "verified": False,
            "confidence": 0.0,
            "message": "Stored facial profile is corrupted. Please re-enroll photo in Student Directory.",
            "verified_at": now
        }

    is_match, confidence = compare_features(live_features, enrolled_features)

    # Save verification record
    record = StudentVerification(
        student_id=student.id,
        status="VERIFIED" if is_match else "MISMATCH",
        confidence=confidence,
        verification_photo=image_base64[:500] if image_base64 else None,
        notes="Automated verification match" if is_match else "Face mismatch detected",
        verified_at=now
    )
    db.add(record)
    db.commit()

    return {
        "student_id": student.id,
        "student_name": student.name,
        "roll_number": student.roll_number,
        "verified": is_match,
        "confidence": confidence,
        "message": f"Verification Successful (Confidence: {int(confidence*100)}%)" if is_match else "Verification Failed: Face did not match enrolled profile",
        "verified_at": record.verified_at
    }
