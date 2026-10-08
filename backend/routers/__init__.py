from backend.routers.student import router as student_router
from backend.routers.student_verification import router as verification_router
from backend.routers.alert import router as alert_router
from backend.routers.monitoring import router as monitoring_router
from backend.routers.auth import router as auth_router

__all__ = [
    "student_router",
    "verification_router",
    "alert_router",
    "monitoring_router",
    "auth_router",
]
