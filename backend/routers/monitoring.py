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
from ai.student_verification import decode_base64_image
from backend.services.alert_service import trigger_inattention_alert

router = APIRouter(prefix="/monitoring", tags=["Monitoring & Attentiveness"])


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

    student = None
    if payload.assigned_student_id:
        student = db.query(Student).filter(Student.id == payload.assigned_student_id).first()
    else:
        # Default to first student in db if exists
        student = db.query(Student).first()

    student_id = student.id if student else None
    student_name = student.name if student else "Unassigned Student"
    student_roll = student.roll_number if student else "N/A"
    student_email = student.email if student else None

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
        student_id=student_id,
        student_name=student_name,
        student_roll=student_roll,
        student_email=student_email
    )

    return {
        "status": "SESSION_STARTED",
        "session_id": session_id,
        "lecture_title": payload.lecture_title,
        "source_type": payload.source_type,
        "camera_connected": camera_manager.is_connected,
        "student_name": student_name,
        "student_roll": student_roll,
        "message": f"Attentiveness monitoring started using {payload.source_type} feed."
    }


@router.post("/session/stop")
def stop_monitoring_session(payload: SessionStopRequest, db: Session = Depends(get_db)):
    summary = monitoring_engine.stop_session()
    camera_manager.stop_source()

    student_id = summary.get("student_id")
    if student_id:
        record = AttendanceRecord(
            student_id=student_id,
            lecture_title=summary.get("lecture_title", "Lecture"),
            session_id=payload.session_id,
            source_type=camera_manager.source_type,
            start_time=datetime.fromisoformat(summary["start_time"]) if summary.get("start_time") else datetime.utcnow(),
            end_time=datetime.fromisoformat(summary["end_time"]) if summary.get("end_time") else datetime.utcnow(),
            duration_seconds=summary.get("duration_seconds", 0),
            total_frames=summary.get("total_frames", 0),
            attentive_frames=summary.get("attentive_frames", 0),
            attentiveness_percentage=summary.get("attentiveness_percentage", 0.0),
            attendance_status=summary.get("attendance_status", "PRESENT"),
            created_at=datetime.utcnow()
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        summary["record_id"] = record.id

    return {
        "status": "SESSION_STOPPED",
        "summary": summary,
        "message": f"Attendance recorded: {summary.get('attendance_status')} ({summary.get('attentiveness_percentage')}%)"
    }


@router.get("/status")
def get_live_monitoring_status():
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
    student_id = payload.get("student_id") or monitoring_engine.student_id
    reason = payload.get("reason", "Manual Teacher Inattention Warning")
    pct = monitoring_engine.get_attentiveness_percentage()

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

        # Process frame with nose direction vector and HUD
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
    """MJPEG live stream endpoint with real-time nose direction vector & HUD overlay"""
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
