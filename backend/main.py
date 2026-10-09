import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.database import engine, Base, SessionLocal
from backend.models import Student, Teacher, AttendanceRecord, Alert
from backend.services.auth_service import get_password_hash
from backend.routers import (
    student_router,
    verification_router,
    alert_router,
    monitoring_router,
    auth_router,
)


def migrate_db_columns():
    """Ensure newly added columns exist in existing SQLite tables"""
    import sqlite3
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "smartclass.db")
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        existing_cols = [c[1] for c in cursor.execute("PRAGMA table_info(teachers)").fetchall()]
        cols_to_add = [
            ("designation", "VARCHAR(100) DEFAULT 'Associate Professor & Lab Lead'"),
            ("employee_id", "VARCHAR(50) DEFAULT 'EMP-CS-2024'"),
            ("phone", "VARCHAR(50) DEFAULT '+91 98450 11223'"),
            ("office_room", "VARCHAR(100) DEFAULT 'Faculty Block B - Room 304'"),
            ("bio", "TEXT DEFAULT 'Specializing in Computer Vision, Facial Biometrics, and Deep Learning Neural Architectures.'"),
            ("photo_url", "TEXT")
        ]
        for col_name, col_type in cols_to_add:
            if col_name not in existing_cols:
                try:
                    cursor.execute(f"ALTER TABLE teachers ADD COLUMN {col_name} {col_type}")
                except Exception as e:
                    print(f"Migration notice for {col_name}: {e}")
        conn.commit()
        conn.close()


def seed_initial_data():
    """Populate database with demo students and teacher on first launch"""
    migrate_db_columns()
    db = SessionLocal()
    try:
        # Check if students exist
        if db.query(Student).count() == 0:
            demo_students = [
                Student(
                    roll_number="CS2026-001",
                    name="Aarav Sharma",
                    email="aarav.sharma@smartclass.edu",
                    parent_email="parent.aarav@gmail.com",
                    phone="+91 98765 43210",
                    department="Computer Science & Engineering",
                    section="A",
                    year="3rd Year",
                ),
                Student(
                    roll_number="CS2026-002",
                    name="Priya Patel",
                    email="priya.patel@smartclass.edu",
                    parent_email="parent.priya@gmail.com",
                    phone="+91 98765 43211",
                    department="Computer Science & Engineering",
                    section="A",
                    year="3rd Year",
                ),
                Student(
                    roll_number="CS2026-003",
                    name="Rohan Verma",
                    email="rohan.verma@smartclass.edu",
                    parent_email="parent.rohan@gmail.com",
                    phone="+91 98765 43212",
                    department="Information Technology",
                    section="B",
                    year="3rd Year",
                ),
                Student(
                    roll_number="CS2026-004",
                    name="Ananya Iyer",
                    email="ananya.iyer@smartclass.edu",
                    parent_email="parent.ananya@gmail.com",
                    phone="+91 98765 43213",
                    department="Artificial Intelligence & Data Science",
                    section="A",
                    year="2nd Year",
                ),
            ]
            db.add_all(demo_students)
            db.commit()

        # Check if default teacher exists
        if db.query(Teacher).count() == 0:
            teacher = Teacher(
                name="Dr. Vikram Sen",
                email="teacher@smartclass.edu",
                department="Computer Science & Engineering",
                subject="Deep Learning & Computer Vision",
                designation="Associate Professor & Lab Lead",
                employee_id="EMP-CS-2024",
                phone="+91 98450 11223",
                office_room="Faculty Block B - Room 304",
                bio="Specializing in Computer Vision, Facial Biometrics, and Deep Learning Neural Architectures.",
                password_hash=get_password_hash("admin123")
            )
            db.add(teacher)
            db.commit()
    finally:
        db.close()



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    # Seed data
    seed_initial_data()
    yield


app = FastAPI(
    title="SmartClass AI Attentiveness & Attendance System",
    description="Automated Student Attentiveness Monitoring, 3D Nose Direction Tracking, and Attendance Automation",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router, prefix="/api")
app.include_router(student_router, prefix="/api")
app.include_router(verification_router, prefix="/api")
app.include_router(alert_router, prefix="/api")
app.include_router(monitoring_router, prefix="/api")


@app.get("/")
def root():
    return {
        "system": "SmartClass AI API",
        "status": "online",
        "version": "1.0.0",
        "features": [
            "Live Camera Attentiveness Detection",
            "3D Nose Direction & Pose Tracking (Yaw/Pitch/Roll)",
            "Automated Attendance Calculation",
            "Automatic Email Alerts to Inattentive Students",
            "Multi-source Support (Webcam, RTSP CCTV, Google Meet Screen Share)",
            "Complete Student Information Management"
        ],
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
