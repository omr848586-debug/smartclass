import cv2
import time
import math
import numpy as np
from datetime import datetime
from typing import Optional, Dict, Any, Tuple, List

# Try importing MediaPipe for 3D multi-face mesh tracking
try:
    import mediapipe as mp
    mp_face_mesh = mp.solutions.face_mesh
    HAS_MEDIAPIPE = True
except Exception:
    HAS_MEDIAPIPE = False

from ai.face_detection import detect_faces, extract_face_crop
from ai.face_recognition import face_recognition_engine


class AttentivenessEngine:
    """
    Real-time Multi-Student Attentiveness & 3D Head/Nose Pose Estimation Engine.
    Simultaneously detects, tracks, and analyzes multiple students in a single video frame.
    Computes 3D nose direction vectors, Euler yaw/pitch, facial identity recognition,
    and individual per-student attendance calculations.
    """

    def __init__(self):
        self.face_mesh = None
        if HAS_MEDIAPIPE:
            try:
                # Support tracking up to 12 students simultaneously
                self.face_mesh = mp_face_mesh.FaceMesh(
                    max_num_faces=12,
                    refine_landmarks=True,
                    min_detection_confidence=0.45,
                    min_tracking_confidence=0.45
                )
            except Exception:
                self.face_mesh = None

        # 3D model generic face points for solvePnP
        self.model_points = np.array([
            (0.0, 0.0, 0.0),          # Nose tip
            (0.0, -330.0, -65.0),     # Chin
            (-225.0, 170.0, -135.0),  # Left eye outer corner
            (225.0, 170.0, -135.0),   # Right eye outer corner
            (-150.0, -150.0, -125.0), # Left mouth corner
            (150.0, -150.0, -125.0)   # Right mouth corner
        ], dtype=np.float64)

        # Session tracking state
        self.is_active = False
        self.session_id: Optional[str] = None
        self.lecture_title: str = "Live Lecture"
        self.assigned_student_id: Optional[int] = None
        self.duration_minutes: Optional[int] = None
        self.time_limit_seconds: Optional[int] = None
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None

        # Global Session Metrics Accumulator
        self.total_frames = 0
        self.attentive_frames = 0
        self.inattentive_frames = 0

        # Multi-student tracker state dictionary: { tracker_key: { id, name, roll, total_frames, attentive_frames, ... } }
        self.student_trackers: Dict[str, Dict[str, Any]] = {}

        # Frame level metrics
        self.detected_faces_count = 0
        self.attentive_students_count = 0
        self.inattentive_students_count = 0
        self.classroom_attentiveness_pct = 100.0
        self.current_students_in_frame: List[Dict[str, Any]] = []

    def start_session(self, session_id: str, lecture_title: str, assigned_student_id: Optional[int] = None,
                      student_name: str = "Classroom Students", student_roll: str = "N/A", student_email: Optional[str] = None,
                      duration_minutes: Optional[int] = None):
        self.session_id = session_id
        self.lecture_title = lecture_title
        self.assigned_student_id = assigned_student_id
        self.duration_minutes = duration_minutes
        self.time_limit_seconds = (duration_minutes * 60) if (duration_minutes and duration_minutes > 0) else None
        self.start_time = datetime.utcnow()
        self.end_time = None
        self.total_frames = 0
        self.attentive_frames = 0
        self.inattentive_frames = 0
        self.student_trackers = {}
        self.is_active = True
        self.detected_faces_count = 0
        self.attentive_students_count = 0
        self.inattentive_students_count = 0
        self.classroom_attentiveness_pct = 100.0
        self.current_students_in_frame = []


    def stop_session(self) -> Dict[str, Any]:
        self.is_active = False
        self.end_time = datetime.utcnow()
        duration_seconds = int((self.end_time - self.start_time).total_seconds()) if self.start_time else 0

        # Compile attendance records for all tracked students
        students_summary = []
        for key, tracker in self.student_trackers.items():
            t_frames = tracker["total_frames"]
            a_frames = tracker["attentive_frames"]
            pct = round((a_frames / t_frames * 100.0), 1) if t_frames > 0 else 100.0
            status = self.calculate_attendance_status(pct)
            students_summary.append({
                "student_id": tracker.get("student_id"),
                "student_name": tracker["name"],
                "student_roll": tracker["roll"],
                "total_frames": t_frames,
                "attentive_frames": a_frames,
                "attentiveness_percentage": pct,
                "attendance_status": status,
            })

        overall_pct = self.get_overall_attentiveness_percentage()
        overall_status = self.calculate_attendance_status(overall_pct)

        return {
            "session_id": self.session_id,
            "lecture_title": self.lecture_title,
            "duration_seconds": duration_seconds,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "total_frames": self.total_frames,
            "total_students_monitored": len(students_summary),
            "attentiveness_percentage": overall_pct,
            "attendance_status": overall_status,
            "students_summary": students_summary,
        }

    def calculate_attendance_status(self, pct: float) -> str:
        if pct >= 75.0:
            return "PRESENT"
        elif pct >= 50.0:
            return "WARNING"
        else:
            return "ABSENT"

    def get_overall_attentiveness_percentage(self) -> float:
        if self.total_frames == 0:
            return 100.0
        return round((self.attentive_frames / self.total_frames) * 100.0, 1)

    def process_frame(self, frame: np.ndarray, on_alert_needed=None) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Process a single BGR frame, compute simultaneous multi-face detection,
        nose direction vectors, face identity recognition, and render multi-student HUD.
        """
        if frame is None or frame.size == 0:
            return frame, self.get_live_metrics()

        H, W = frame.shape[:2]
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        detected_faces_data = []

        # 1. Primary multi-face detection & 3D pose using MediaPipe FaceMesh
        if self.face_mesh:
            results = self.face_mesh.process(rgb_frame)
            if results and results.multi_face_landmarks:
                for idx, landmarks in enumerate(results.multi_face_landmarks):
                    # Specific landmark indices
                    image_points = np.array([
                        (landmarks.landmark[1].x * W, landmarks.landmark[1].y * H),     # Nose tip
                        (landmarks.landmark[199].x * W, landmarks.landmark[199].y * H), # Chin
                        (landmarks.landmark[33].x * W, landmarks.landmark[33].y * H),   # Left eye corner
                        (landmarks.landmark[263].x * W, landmarks.landmark[263].y * H), # Right eye corner
                        (landmarks.landmark[61].x * W, landmarks.landmark[61].y * H),   # Left mouth corner
                        (landmarks.landmark[291].x * W, landmarks.landmark[291].y * H)  # Right mouth corner
                    ], dtype=np.float64)

                    focal_length = W
                    center = (W / 2, H / 2)
                    camera_matrix = np.array([
                        [focal_length, 0, center[0]],
                        [0, focal_length, center[1]],
                        [0, 0, 1]
                    ], dtype=np.float64)
                    dist_coeffs = np.zeros((4, 1))

                    success, rvec, tvec = cv2.solvePnP(
                        self.model_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
                    )

                    yaw, pitch, roll = 0.0, 0.0, 0.0
                    nose_start = (int(image_points[0][0]), int(image_points[0][1]))
                    nose_end = None

                    if success:
                        nose_3d_point = np.array([(0.0, 0.0, 120.0)], dtype=np.float64)
                        projected_points, _ = cv2.projectPoints(nose_3d_point, rvec, tvec, camera_matrix, dist_coeffs)
                        nose_end = (int(projected_points[0][0][0]), int(projected_points[0][0][1]))

                        rmat, _ = cv2.Rodrigues(rvec)
                        angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
                        pitch = float(angles[0] * 360)
                        yaw = float(angles[1] * 360)
                        roll = float(angles[2] * 360)

                    # Compute face bounding box
                    xs = [int(p.x * W) for p in landmarks.landmark]
                    ys = [int(p.y * H) for p in landmarks.landmark]
                    min_x, max_x = max(0, min(xs)), min(W, max(xs))
                    min_y, max_y = max(0, min(ys)), min(H, max(ys))
                    face_bbox = (min_x, min_y, max_x - min_x, max_y - min_y)

                    # Attentiveness logic based on individual 3D Nose Pose
                    if abs(yaw) > 22.0:
                        is_attentive = False
                        reason = f"Looking {'Left' if yaw > 0 else 'Right'} ({int(yaw)}°)"
                    elif pitch > 18.0:
                        is_attentive = False
                        reason = f"Looking Down ({int(pitch)}°)"
                    elif pitch < -16.0:
                        is_attentive = False
                        reason = f"Looking Up ({int(pitch)}°)"
                    else:
                        is_attentive = True
                        reason = "Focused on Lecture"

                    # Identify face against enrolled student roster
                    crop = extract_face_crop(frame, face_bbox)
                    student_match, confidence = face_recognition_engine.identify_face(crop)

                    if student_match:
                        student_id = student_match["id"]
                        student_name = student_match["name"]
                        student_roll = student_match["roll_number"]
                    elif self.assigned_student_id and idx == 0:
                        student_id = self.assigned_student_id
                        student_name = "Assigned Student"
                        student_roll = "ID"
                    else:
                        student_id = None
                        student_name = f"Student #{idx + 1}"
                        student_roll = f"Desk-{idx + 1}"

                    detected_faces_data.append({
                        "face_idx": idx,
                        "bbox": face_bbox,
                        "nose_start": nose_start,
                        "nose_end": nose_end,
                        "yaw": round(yaw, 1),
                        "pitch": round(pitch, 1),
                        "roll": round(roll, 1),
                        "is_attentive": is_attentive,
                        "reason": reason,
                        "student_id": student_id,
                        "student_name": student_name,
                        "student_roll": student_roll,
                        "confidence": confidence if student_match else 0.0,
                    })

        # 2. Fallback / supplementary Haar multi-face detector if mediapipe yielded 0 faces
        if len(detected_faces_data) == 0:
            haar_faces = detect_faces(frame)
            for idx, bbox in enumerate(haar_faces):
                fx, fy, fw, fh = bbox
                crop = extract_face_crop(frame, bbox)
                student_match, confidence = face_recognition_engine.identify_face(crop)

                if student_match:
                    student_id = student_match["id"]
                    student_name = student_match["name"]
                    student_roll = student_match["roll_number"]
                else:
                    student_id = None
                    student_name = f"Student #{idx + 1}"
                    student_roll = f"Desk-{idx + 1}"

                nose_start = (fx + fw // 2, fy + fh // 2)
                nose_end = (fx + fw // 2, fy + fh // 2 - 25)

                detected_faces_data.append({
                    "face_idx": idx,
                    "bbox": bbox,
                    "nose_start": nose_start,
                    "nose_end": nose_end,
                    "yaw": 0.0,
                    "pitch": 0.0,
                    "roll": 0.0,
                    "is_attentive": True,
                    "reason": "Face Active (Focused)",
                    "student_id": student_id,
                    "student_name": student_name,
                    "student_roll": student_roll,
                    "confidence": confidence if student_match else 0.0,
                })

        # Update Frame & Session Metrics
        num_faces = len(detected_faces_data)
        attentive_count = sum(1 for f in detected_faces_data if f["is_attentive"])
        inattentive_count = num_faces - attentive_count

        self.detected_faces_count = num_faces
        self.attentive_students_count = attentive_count
        self.inattentive_students_count = inattentive_count
        self.current_students_in_frame = detected_faces_data

        if self.is_active:
            self.total_frames += 1
            if num_faces > 0:
                if attentive_count >= inattentive_count:
                    self.attentive_frames += 1
                else:
                    self.inattentive_frames += 1
            else:
                self.inattentive_frames += 1

            # Update per-student cumulative stats
            current_time = time.time()
            for f in detected_faces_data:
                tracker_key = f"{f['student_id'] or f['student_name']}"
                if tracker_key not in self.student_trackers:
                    self.student_trackers[tracker_key] = {
                        "student_id": f["student_id"],
                        "name": f["student_name"],
                        "roll": f["student_roll"],
                        "total_frames": 0,
                        "attentive_frames": 0,
                        "inattentive_frames": 0,
                        "consecutive_inattentive_sec": 0.0,
                        "last_alert_time": 0.0,
                    }

                tracker = self.student_trackers[tracker_key]
                tracker["total_frames"] += 1
                if f["is_attentive"]:
                    tracker["attentive_frames"] += 1
                    tracker["consecutive_inattentive_sec"] = max(0.0, tracker["consecutive_inattentive_sec"] - 0.1)
                else:
                    tracker["inattentive_frames"] += 1
                    tracker["consecutive_inattentive_sec"] += 0.05

                    # Alert if individual student is inattentive for >= 10s or below 50%
                    t_pct = (tracker["attentive_frames"] / tracker["total_frames"]) * 100.0 if tracker["total_frames"] > 0 else 100.0
                    should_alert = (
                        (tracker["total_frames"] >= 30 and t_pct < 50.0) or
                        (tracker["consecutive_inattentive_sec"] >= 10.0)
                    )
                    if should_alert and (current_time - tracker["last_alert_time"] > 60.0):
                        tracker["last_alert_time"] = current_time
                        if on_alert_needed:
                            on_alert_needed(
                                student_id=f["student_id"],
                                reason=f"Inattention Alert: {f['student_name']} - {f['reason']}",
                                attentiveness_pct=t_pct
                            )

        self.classroom_attentiveness_pct = self.get_overall_attentiveness_percentage()

        # Render Multi-Student HUD
        annotated_frame = self._render_multi_hud(frame, detected_faces_data)
        return annotated_frame, self.get_live_metrics()

    def _render_multi_hud(self, frame: np.ndarray, faces_data: List[Dict[str, Any]]) -> np.ndarray:
        out = frame.copy()
        H, W = out.shape[:2]

        # 1. Render HUD for EACH detected student face
        for f in faces_data:
            bbox = f["bbox"]
            nose_start = f["nose_start"]
            nose_end = f["nose_end"]
            is_attentive = f["is_attentive"]
            student_name = f["student_name"]
            student_roll = f["student_roll"]
            yaw = f["yaw"]
            pitch = f["pitch"]
            reason = f["reason"]

            color_theme = (40, 220, 100) if is_attentive else (40, 60, 240)  # Green / Red

            if bbox:
                bx, by, bw, bh = bbox
                # Bounding box
                cv2.rectangle(out, (bx, by), (bx + bw, by + bh), color_theme, 2)

                # High-tech corner brackets
                bracket_len = min(18, bw // 4)
                cv2.line(out, (bx, by), (bx + bracket_len, by), color_theme, 3)
                cv2.line(out, (bx, by), (bx, by + bracket_len), color_theme, 3)
                cv2.line(out, (bx + bw, by), (bx + bw - bracket_len, by), color_theme, 3)
                cv2.line(out, (bx + bw, by), (bx + bw, by + bracket_len), color_theme, 3)
                cv2.line(out, (bx, by + bh), (bx + bracket_len, by + bh), color_theme, 3)
                cv2.line(out, (bx, by + bh), (bx, by + bh - bracket_len), color_theme, 3)
                cv2.line(out, (bx + bw, by + bh), (bx + bw - bracket_len, by + bh), color_theme, 3)
                cv2.line(out, (bx + bw, by + bh), (bx + bw, by + bh - bracket_len), color_theme, 3)

                # Name & Status Badge above face
                badge_text = f"{student_name} ({student_roll})"
                status_text = "FOCUSED" if is_attentive else f"DISTRACTED ({reason})"

                badge_h = 36
                cv2.rectangle(out, (bx, max(0, by - badge_h)), (bx + max(bw, 140), by), (15, 12, 28), -1)
                cv2.rectangle(out, (bx, max(0, by - badge_h)), (bx + max(bw, 140), by), color_theme, 1)

                cv2.putText(out, badge_text, (bx + 5, max(14, by - 20)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)
                cv2.putText(out, status_text, (bx + 5, max(26, by - 6)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.35, color_theme, 1)

            # 3D Nose Direction Arrow for this face
            if nose_start and nose_end:
                cv2.circle(out, nose_start, 3, (0, 255, 255), -1)
                cv2.arrowedLine(out, nose_start, nose_end, color_theme, 2, tipLength=0.25)

        # 2. Top Multi-Student Status Banner
        overlay = out.copy()
        cv2.rectangle(overlay, (0, 0), (W, 46), (14, 10, 31), -1)
        cv2.addWeighted(overlay, 0.85, out, 0.15, 0, out)

        # Elapsed and remaining time string
        timer_str = ""
        if self.is_active and self.start_time:
            elapsed = int((datetime.utcnow() - self.start_time).total_seconds())
            if self.time_limit_seconds:
                rem = max(0, self.time_limit_seconds - elapsed)
                rem_m = rem // 60
                rem_s = rem % 60
                timer_str = f" | ⏳ Auto-Stop: {rem_m:02d}:{rem_s:02d}"
            else:
                el_m = elapsed // 60
                el_s = elapsed % 60
                timer_str = f" | ⏱ {el_m:02d}:{el_s:02d}"

        session_info = f"Lecture: {self.lecture_title}{timer_str} | ({len(faces_data)} Students in View)"
        cv2.putText(out, session_info, (14, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.46, (240, 240, 255), 1)

        # Active Students Count Pill
        pill_text = f"{self.attentive_students_count}/{len(faces_data)} Attentive"
        pill_color = (30, 200, 80) if self.attentive_students_count >= self.inattentive_students_count else (30, 60, 240)
        cv2.rectangle(out, (W - 190, 8), (W - 12, 38), pill_color, -1)
        cv2.putText(out, pill_text, (W - 175, 27), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 2)

        # 3. Bottom HUD Analytics Bar
        overlay_bottom = out.copy()
        cv2.rectangle(overlay_bottom, (0, H - 48), (W, H), (14, 10, 31), -1)
        cv2.addWeighted(overlay_bottom, 0.85, out, 0.15, 0, out)

        pct = self.classroom_attentiveness_pct
        pct_color = (40, 220, 100) if pct >= 75 else ((0, 190, 255) if pct >= 50 else (40, 60, 240))
        pct_text = f"Classroom Attentiveness: {pct:.1f}% ({self.calculate_attendance_status(pct)})"
        cv2.putText(out, pct_text, (14, H - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, pct_color, 2)

        stats_text = f"Simultaneous Students: {len(faces_data)} Detected | {self.attentive_students_count} Attentive | {self.inattentive_students_count} Inattentive"
        cv2.putText(out, stats_text, (W - 560, H - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (200, 210, 230), 1)

        return out

    def get_live_metrics(self) -> Dict[str, Any]:
        pct = self.classroom_attentiveness_pct
        attendance_status = self.calculate_attendance_status(pct)

        # Calculate time metrics
        elapsed_seconds = 0
        remaining_seconds = None
        is_time_expired = False

        if self.is_active and self.start_time:
            elapsed_seconds = int((datetime.utcnow() - self.start_time).total_seconds())
            if self.time_limit_seconds is not None:
                remaining_seconds = max(0, self.time_limit_seconds - elapsed_seconds)
                if remaining_seconds <= 0:
                    is_time_expired = True

        # Build list of active students in frame
        active_list = []
        for f in self.current_students_in_frame:
            active_list.append({
                "student_id": f.get("student_id"),
                "student_name": f["student_name"],
                "student_roll": f["student_roll"],
                "is_attentive": f["is_attentive"],
                "reason": f["reason"],
                "yaw": f["yaw"],
                "pitch": f["pitch"],
            })

        # Tracked students list with cumulative scores
        tracked_list = []
        for key, tracker in self.student_trackers.items():
            t_frames = tracker["total_frames"]
            a_frames = tracker["attentive_frames"]
            t_pct = round((a_frames / t_frames * 100.0), 1) if t_frames > 0 else 100.0
            tracked_list.append({
                "student_id": tracker.get("student_id"),
                "student_name": tracker["name"],
                "student_roll": tracker["roll"],
                "attentiveness_percentage": t_pct,
                "attendance_status": self.calculate_attendance_status(t_pct),
                "total_frames": t_frames,
                "attentive_frames": a_frames,
            })

        first_face = self.current_students_in_frame[0] if len(self.current_students_in_frame) > 0 else None

        return {
            "is_active": self.is_active,
            "session_id": self.session_id,
            "lecture_title": self.lecture_title,
            "duration_minutes": self.duration_minutes,
            "elapsed_seconds": elapsed_seconds,
            "remaining_seconds": remaining_seconds,
            "is_time_expired": is_time_expired,
            "detected_faces_count": self.detected_faces_count,
            "attentive_students_count": self.attentive_students_count,
            "inattentive_students_count": self.inattentive_students_count,
            "classroom_attentiveness_percentage": pct,
            "attentiveness_percentage": pct,
            "attendance_status": attendance_status,
            "total_frames": self.total_frames,
            "attentive_frames": self.attentive_frames,
            "inattentive_frames": self.inattentive_frames,
            "current_status": "ATTENTIVE" if self.attentive_students_count >= self.inattentive_students_count and self.detected_faces_count > 0 else ("INATTENTIVE" if self.detected_faces_count > 0 else "NO_FACE"),
            "current_reason": first_face["reason"] if first_face else ("Ready to monitor" if not self.is_active else "No faces detected in frame"),
            "yaw": first_face["yaw"] if first_face else 0.0,
            "pitch": first_face["pitch"] if first_face else 0.0,
            "is_face_detected": self.detected_faces_count > 0,
            "active_students": active_list,
            "tracked_students": tracked_list,
        }



# Global monitoring engine instance
monitoring_engine = AttentivenessEngine()
