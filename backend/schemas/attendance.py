from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class SessionStartRequest(BaseModel):
    lecture_title: str = "Live Class Lecture"
    source_type: str = "WEBCAM"  # WEBCAM, RTSP, GOOGLE_MEET
    rtsp_url: Optional[str] = None
    camera_index: int = 0
    assigned_student_id: Optional[int] = None  # Track specific student in 1-on-1 / verification mode


class SessionStopRequest(BaseModel):
    session_id: str


class AttendanceRecordResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    roll_number: str
    department: str
    lecture_title: str
    session_id: str
    source_type: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: int
    attentiveness_percentage: float
    attendance_status: str  # PRESENT, WARNING, ABSENT
    alert_count: int
    email_sent: bool

    class Config:
        from_attributes = True


class AttendanceSummary(BaseModel):
    total_sessions: int
    total_students_monitored: int
    present_count: int
    warning_count: int
    absent_count: int
    avg_attentiveness: float
