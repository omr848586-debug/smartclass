import cv2
import uuid
import time
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.database import get_db, SessionLocal
from backend.models.student import Student
from backend.models.attendance import AttendanceRecord
from backend.schemas.attendance import (
    SessionStartRequest,
    SessionStopRequest,
    AttendanceRecordResponse,
    AttendanceSummary
)
from ai.camera import camera_manager
from ai.monitoring import monitoring_engine
from ai.face_recognition import face_recognition_engine
from ai.student_verification import decode_base64_image
from backend.services.alert_service import trigger_inattention_alert

router = APIRouter(prefix="/monitoring", tags=["Monitoring & Attentiveness"])


def load_roster_embeddings(db: Session):
    """Load all enrolled students into memory for fast real-time recognition"""
    students_all = db.query(Student).all()
    students_data = [
        {
            "id": s.id,
            "name": s.name,
            "roll_number": s.roll_number,
            "email": s.email,
            "face_encoding": s.face_encoding
        }
        for s in students_all
    ]
    face_recognition_engine.load_known_students(students_data)


def alert_callback(student_id: Optional[int], reason: str, attentiveness_pct: float):
    """Triggered by monitoring engine when inattention threshold is exceeded"""
    db = SessionLocal()
    try:
        trigger_inattention_alert(
            db=db,
            student_id=student_id,
            lecture_title=monitoring_engine.lecture_title,
            attentiveness_score=attentiveness_pct,
            reason=reason
        )
    finally:
        db.close()


@router.post("/session/start")
def start_monitoring_session(payload: SessionStartRequest, db: Session = Depends(get_db)):
    session_id = str(uuid.uuid4())[:8]

    # Pre-load registered student embeddings for multi-face recognition
    load_roster_embeddings(db)

    # Start camera source
    camera_manager.start_source(
        source_type=payload.source_type,
        source_url=payload.rtsp_url,
        camera_index=payload.camera_index
    )

    # Start monitoring engine
    monitoring_engine.start_session(
        session_id=session_id,
        lecture_title=payload.lecture_title,
        assigned_student_id=payload.assigned_student_id,
        duration_minutes=payload.duration_minutes
    )

    return {
        "status": "SESSION_STARTED",
        "session_id": session_id,
        "lecture_title": payload.lecture_title,
        "source_type": payload.source_type,
        "duration_minutes": payload.duration_minutes,
        "camera_connected": camera_manager.is_connected,
        "message": f"Multi-student simultaneous AI monitoring started using {payload.source_type} feed."
    }



@router.post("/session/stop")
def stop_monitoring_session(payload: SessionStopRequest, db: Session = Depends(get_db)):
    summary = monitoring_engine.stop_session()
    camera_manager.stop_source()

    students_summary = summary.get("students_summary", [])
    records_saved = 0

    # If specific students were tracked, create individual attendance records
    if len(students_summary) > 0:
        for st in students_summary:
            st_id = st.get("student_id")
            if not st_id:
                # Fallback to first student or assigned student
                first_st = db.query(Student).first()
                st_id = first_st.id if first_st else None

            if st_id:
                record = AttendanceRecord(
                    student_id=st_id,
                    lecture_title=summary.get("lecture_title", "Lecture"),
                    session_id=payload.session_id,
                    source_type=camera_manager.source_type,
                    start_time=datetime.fromisoformat(summary["start_time"]) if summary.get("start_time") else datetime.utcnow(),
                    end_time=datetime.fromisoformat(summary["end_time"]) if summary.get("end_time") else datetime.utcnow(),
                    duration_seconds=summary.get("duration_seconds", 0),
                    total_frames=st.get("total_frames", summary.get("total_frames", 0)),
                    attentive_frames=st.get("attentive_frames", summary.get("attentive_frames", 0)),
                    attentiveness_percentage=st.get("attentiveness_percentage", 100.0),
                    attendance_status=st.get("attendance_status", "PRESENT"),
                    created_at=datetime.utcnow()
                )
                db.add(record)
                records_saved += 1

        db.commit()
    else:
        # If no faces were detected, save session record for assigned student
        student = db.query(Student).first()
        if student:
            record = AttendanceRecord(
                student_id=student.id,
                lecture_title=summary.get("lecture_title", "Lecture"),
                session_id=payload.session_id,
                source_type=camera_manager.source_type,
                start_time=datetime.fromisoformat(summary["start_time"]) if summary.get("start_time") else datetime.utcnow(),
                end_time=datetime.fromisoformat(summary["end_time"]) if summary.get("end_time") else datetime.utcnow(),
                duration_seconds=summary.get("duration_seconds", 0),
                total_frames=summary.get("total_frames", 0),
                attentive_frames=summary.get("attentive_frames", 0),
                attentiveness_percentage=summary.get("attentiveness_percentage", 0.0),
                attendance_status=summary.get("attendance_status", "ABSENT"),
                created_at=datetime.utcnow()
            )
            db.add(record)
            db.commit()
            records_saved += 1

    return {
        "status": "SESSION_STOPPED",
        "summary": summary,
        "records_created": records_saved,
        "message": f"Multi-student attendance recorded for {records_saved} student(s) (Classroom Average: {summary.get('attentiveness_percentage')}%)"
    }


@router.get("/status")
def get_live_monitoring_status(db: Session = Depends(get_db)):
    # Ensure known students are loaded
    if len(face_recognition_engine.known_students) == 0:
        load_roster_embeddings(db)

    metrics = monitoring_engine.get_live_metrics()
    metrics["camera_connected"] = camera_manager.is_connected
    metrics["source_type"] = camera_manager.source_type
    metrics["camera_error"] = camera_manager.error_message
    return metrics


@router.post("/frame_push")
def push_screen_capture_frame(payload: dict):
    """Receives base64 frames from Google Meet screen capture in frontend"""
    image_base64 = payload.get("image_base64")
    if not image_base64:
        raise HTTPException(status_code=400, detail="Missing image_base64")

    frame = decode_base64_image(image_base64)
    if frame is not None:
        camera_manager.push_external_frame(frame)
        return {"status": "FRAME_ACCEPTED"}
    return {"status": "FRAME_DECODE_FAILED"}


@router.post("/trigger_alert")
def trigger_manual_alert(payload: dict, db: Session = Depends(get_db)):
    student_id = payload.get("student_id")
    reason = payload.get("reason", "Teacher Inattention Warning")
    pct = monitoring_engine.get_overall_attentiveness_percentage()

    alert = trigger_inattention_alert(
        db=db,
        student_id=student_id,
        lecture_title=monitoring_engine.lecture_title,
        attentiveness_score=pct,
        reason=reason
    )
    return {
        "status": "ALERT_TRIGGERED",
        "alert_id": alert.id if alert else None,
        "message": f"Alert email dispatched to student for '{reason}'"
    }


def generate_mjpeg_stream():
    """Generator for streaming processed video frames with HUD over MJPEG"""
    while True:
        frame = camera_manager.get_frame()
        if frame is None:
            time.sleep(0.04)
            continue

        # Process frame with simultaneous multi-face detection, nose direction vector, and HUD
        annotated_frame, _ = monitoring_engine.process_frame(frame, on_alert_needed=alert_callback)

        ret, buffer = cv2.imencode(".jpg", annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
        if not ret:
            time.sleep(0.03)
            continue

        frame_bytes = buffer.tobytes()
        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")
        time.sleep(0.03)


@router.get("/video_feed")
def get_video_feed():
    """MJPEG live stream endpoint with real-time multi-face nose direction vectors & HUD overlay"""
    return StreamingResponse(
        generate_mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@router.get("/attendance", response_model=List[AttendanceRecordResponse])
def get_attendance_records(
    limit: int = 50,
    student_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AttendanceRecord)
    if student_id:
        query = query.filter(AttendanceRecord.student_id == student_id)

    records = query.order_by(AttendanceRecord.created_at.desc()).limit(limit).all()

    out = []
    for r in records:
        student = db.query(Student).filter(Student.id == r.student_id).first()
        out.append(AttendanceRecordResponse(
            id=r.id,
            student_id=r.student_id,
            student_name=student.name if student else "Unknown",
            roll_number=student.roll_number if student else "N/A",
            department=student.department if student else "N/A",
            lecture_title=r.lecture_title,
            session_id=r.session_id,
            source_type=r.source_type,
            start_time=r.start_time,
            end_time=r.end_time,
            duration_seconds=r.duration_seconds,
            attentiveness_percentage=r.attentiveness_percentage,
            attendance_status=r.attendance_status,
            alert_count=r.alert_count,
            email_sent=r.email_sent
        ))
    return out


@router.get("/attendance/summary", response_model=AttendanceSummary)
def get_attendance_summary(db: Session = Depends(get_db)):
    records = db.query(AttendanceRecord).all()
    total = len(records)
    if total == 0:
        return AttendanceSummary(
            total_sessions=0,
            total_students_monitored=0,
            present_count=0,
            warning_count=0,
            absent_count=0,
            avg_attentiveness=0.0
        )

    present = sum(1 for r in records if r.attendance_status == "PRESENT")
    warning = sum(1 for r in records if r.attendance_status == "WARNING")
    absent = sum(1 for r in records if r.attendance_status == "ABSENT")
    avg_att = sum(r.attentiveness_percentage for r in records) / total

    return AttendanceSummary(
        total_sessions=total,
        total_students_monitored=total,
        present_count=present,
        warning_count=warning,
        absent_count=absent,
        avg_attentiveness=round(avg_att, 1)
    )
