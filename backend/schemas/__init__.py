from backend.schemas.student import StudentBase, StudentCreate, StudentUpdate, StudentResponse
from backend.schemas.teacher import TeacherBase, TeacherCreate, TeacherLogin, TeacherResponse
from backend.schemas.student_verification import VerificationRequest, VerificationResponse
from backend.schemas.alert import AlertCreate, AlertResponse, EmailConfigTestRequest
from backend.schemas.attendance import (
    SessionStartRequest,
    SessionStopRequest,
    AttendanceRecordResponse,
    AttendanceSummary
)

__all__ = [
    "StudentBase",
    "StudentCreate",
    "StudentUpdate",
    "StudentResponse",
    "TeacherBase",
    "TeacherCreate",
    "TeacherLogin",
    "TeacherResponse",
    "VerificationRequest",
    "VerificationResponse",
    "AlertCreate",
    "AlertResponse",
    "EmailConfigTestRequest",
    "SessionStartRequest",
    "SessionStopRequest",
    "AttendanceRecordResponse",
    "AttendanceSummary",
]
