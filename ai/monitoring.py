import cv2
import time
import math
import numpy as np
from datetime import datetime
from typing import Optional, Dict, Any, Tuple

# Try importing MediaPipe for 3D nose direction tracking
try:
    import mediapipe as mp
    mp_face_mesh = mp.solutions.face_mesh
    HAS_MEDIAPIPE = True
except Exception:
    HAS_MEDIAPIPE = False

from ai.face_detection import detect_faces


class AttentivenessEngine:
    """
    Real-time student attentiveness and head/nose pose estimation engine.
    Calculates 3D nose direction vector, head yaw/pitch, face presence,
    and cumulative attentiveness percentage for automated attendance.
    """

    def __init__(self):
        self.face_mesh = None
        if HAS_MEDIAPIPE:
            try:
                self.face_mesh = mp_face_mesh.FaceMesh(
                    max_num_faces=1,
                    refine_landmarks=True,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5
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
        self.student_id: Optional[int] = None
        self.student_name: str = "Student"
        self.student_roll: str = "N/A"
        self.student_email: Optional[str] = None
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None

        # Metrics accumulators
        self.total_frames = 0
        self.attentive_frames = 0
        self.inattentive_frames = 0
        self.absent_frames = 0
        self.continuous_inattentive_seconds = 0.0
        self.last_inattention_alert_time = 0.0

        # Current frame state
        self.current_status = "READY"
        self.current_reason = ""
        self.current_yaw = 0.0
        self.current_pitch = 0.0
        self.current_roll = 0.0
        self.is_face_detected = False
        self.attentiveness_percentage = 100.0

    def start_session(self, session_id: str, lecture_title: str, student_id: Optional[int] = None,
                      student_name: str = "Student", student_roll: str = "N/A", student_email: Optional[str] = None):
        self.session_id = session_id
        self.lecture_title = lecture_title
        self.student_id = student_id
        self.student_name = student_name
        self.student_roll = student_roll
        self.student_email = student_email
        self.start_time = datetime.utcnow()
        self.end_time = None
        self.total_frames = 0
        self.attentive_frames = 0
        self.inattentive_frames = 0
        self.absent_frames = 0
        self.continuous_inattentive_seconds = 0.0
        self.last_inattention_alert_time = 0.0
        self.attentiveness_percentage = 100.0
        self.is_active = True
        self.current_status = "MONITORING"

    def stop_session(self) -> Dict[str, Any]:
        self.is_active = False
        self.end_time = datetime.utcnow()
        duration_seconds = int((self.end_time - self.start_time).total_seconds()) if self.start_time else 0

        final_pct = self.get_attentiveness_percentage()
        attendance_status = self.calculate_attendance_status(final_pct)

        return {
            "session_id": self.session_id,
            "lecture_title": self.lecture_title,
            "student_id": self.student_id,
            "student_name": self.student_name,
            "student_roll": self.student_roll,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": duration_seconds,
            "total_frames": self.total_frames,
            "attentive_frames": self.attentive_frames,
            "attentiveness_percentage": round(final_pct, 2),
            "attendance_status": attendance_status,
        }

    def calculate_attendance_status(self, pct: float) -> str:
        """
        Attendance logic based on attentiveness percentage:
        - >= 75%: PRESENT
        - 50% - 74.9%: WARNING
        - < 50%: ABSENT
        """
        if pct >= 75.0:
            return "PRESENT"
        elif pct >= 50.0:
            return "WARNING"
        else:
            return "ABSENT"

    def get_attentiveness_percentage(self) -> float:
        if self.total_frames == 0:
            return 100.0
        return round((self.attentive_frames / self.total_frames) * 100.0, 1)

    def process_frame(self, frame: np.ndarray, on_alert_needed=None) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Process a single BGR frame, compute nose direction & attentiveness,
        and render HUD overlays.
        """
        if frame is None or frame.size == 0:
            return frame, self.get_live_metrics()

        H, W = frame.shape[:2]
        is_attentive = False
        reason = ""
        yaw = 0.0
        pitch = 0.0
        roll = 0.0
        nose_2d = None
        nose_endpoint_2d = None
        face_bbox = None

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_found = False

        if self.face_mesh:
            results = self.face_mesh.process(rgb_frame)
            if results and results.multi_face_landmarks:
                face_found = True
                landmarks = results.multi_face_landmarks[0]

                # Specific landmark indices
                # 1: Nose tip, 199: Chin, 33: Left eye outer, 263: Right eye outer, 61: Left mouth, 291: Right mouth
                image_points = np.array([
                    (landmarks.landmark[1].x * W, landmarks.landmark[1].y * H),     # Nose tip
                    (landmarks.landmark[199].x * W, landmarks.landmark[199].y * H), # Chin
                    (landmarks.landmark[33].x * W, landmarks.landmark[33].y * H),   # Left eye corner
                    (landmarks.landmark[263].x * W, landmarks.landmark[263].y * H), # Right eye corner
                    (landmarks.landmark[61].x * W, landmarks.landmark[61].y * H),   # Left mouth corner
                    (landmarks.landmark[291].x * W, landmarks.landmark[291].y * H)  # Right mouth corner
                ], dtype=np.float64)

                # Camera matrix approximation
                focal_length = W
                center = (W / 2, H / 2)
                camera_matrix = np.array([
                    [focal_length, 0, center[0]],
                    [0, focal_length, center[1]],
                    [0, 0, 1]
                ], dtype=np.float64)

                dist_coeffs = np.zeros((4, 1))

                # Solve PnP
                success, rvec, tvec = cv2.solvePnP(
                    self.model_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
                )

                if success:
                    # Project 3D nose vector forward by 100 units
                    nose_3d_point = np.array([(0.0, 0.0, 120.0)], dtype=np.float64)
                    projected_points, _ = cv2.projectPoints(nose_3d_point, rvec, tvec, camera_matrix, dist_coeffs)

                    nose_2d = (int(image_points[0][0]), int(image_points[0][1]))
                    nose_endpoint_2d = (int(projected_points[0][0][0]), int(projected_points[0][0][1]))

                    # Calculate Euler angles
                    rmat, _ = cv2.Rodrigues(rvec)
                    angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
                    pitch = float(angles[0] * 360)
                    yaw = float(angles[1] * 360)
                    roll = float(angles[2] * 360)

                    # Bounding box around all landmarks
                    xs = [int(p.x * W) for p in landmarks.landmark]
                    ys = [int(p.y * H) for p in landmarks.landmark]
                    min_x, max_x = max(0, min(xs)), min(W, max(xs))
                    min_y, max_y = max(0, min(ys)), min(H, max(ys))
                    face_bbox = (min_x, min_y, max_x - min_x, max_y - min_y)

                    # Attentiveness decision via Nose Direction & Head Pose
                    # Normal forward view: |yaw| <= 22 deg, -15 <= pitch <= 18 deg
                    if abs(yaw) > 22.0:
                        is_attentive = False
                        reason = f"Looking {'Left' if yaw > 0 else 'Right'} (Yaw: {int(yaw)}°)"
                    elif pitch > 18.0:
                        is_attentive = False
                        reason = f"Looking Down / Phone (Pitch: {int(pitch)}°)"
                    elif pitch < -16.0:
                        is_attentive = False
                        reason = f"Looking Up / Ceiling (Pitch: {int(pitch)}°)"
                    else:
                        is_attentive = True
                        reason = "Focused on Lecture"

        # Fallback to Haar Cascade if MediaPipe was unable or not installed
        if not face_found:
            faces = detect_faces(frame)
            if len(faces) > 0:
                face_found = True
                face_bbox = faces[0]
                is_attentive = True
                reason = "Face Detected (Attentive)"
                # Center point for nose approximation
                fx, fy, fw, fh = face_bbox
                nose_2d = (fx + fw // 2, fy + fh // 2)
                nose_endpoint_2d = (fx + fw // 2, fy + fh // 2 - 20)
            else:
                face_found = False
                is_attentive = False
                reason = "No Face Detected (Absent)"

        # Update engine states
        self.is_face_detected = face_found
        self.current_yaw = round(yaw, 1)
        self.current_pitch = round(pitch, 1)
        self.current_roll = round(roll, 1)
        self.current_reason = reason
        self.current_status = "ATTENTIVE" if is_attentive else "INATTENTIVE"

        # Update metrics if session is active
        if self.is_active:
            self.total_frames += 1
            if is_attentive:
                self.attentive_frames += 1
                self.continuous_inattentive_seconds = max(0.0, self.continuous_inattentive_seconds - 0.1)
            else:
                self.inattentive_frames += 1
                if not face_found:
                    self.absent_frames += 1
                self.continuous_inattentive_seconds += 0.05  # assuming approx 20-30 fps

                # Alert trigger conditions:
                # 1. Attentiveness percentage falls below 50% threshold (after at least 30 frames)
                # 2. Continuous inattention for >= 10 seconds
                current_time = time.time()
                current_pct = self.get_attentiveness_percentage()
                is_below_50 = (self.total_frames >= 30 and current_pct < 50.0)
                is_sustained_inattentive = (self.continuous_inattentive_seconds >= 10.0)

                if (is_below_50 or is_sustained_inattentive) and (current_time - self.last_inattention_alert_time > 60.0):
                    self.last_inattention_alert_time = current_time
                    trigger_reason = f"Attentiveness dropped below 50% ({current_pct:.1f}%) - {reason}" if is_below_50 else reason
                    if on_alert_needed:
                        on_alert_needed(
                            student_id=self.student_id,
                            reason=trigger_reason,
                            attentiveness_pct=current_pct
                        )

            self.attentiveness_percentage = self.get_attentiveness_percentage()

        # Render HUD on frame
        annotated_frame = self._render_hud(
            frame, face_bbox, nose_2d, nose_endpoint_2d, is_attentive, reason, yaw, pitch
        )

        return annotated_frame, self.get_live_metrics()

    def _render_hud(self, frame: np.ndarray, bbox, nose_start, nose_end,
                    is_attentive: bool, reason: str, yaw: float, pitch: float) -> np.ndarray:
        out = frame.copy()
        H, W = out.shape[:2]

        color_theme = (40, 220, 100) if is_attentive else (40, 60, 240)  # Green or Red
        text_theme = (255, 255, 255)

        # 1. Draw Face Bounding Box & HUD brackets
        if bbox:
            bx, by, bw, bh = bbox
            cv2.rectangle(out, (bx, by), (bx + bw, by + bh), color_theme, 2)

            # Corner brackets for premium aesthetic
            bracket_len = min(20, bw // 4)
            # Top-left
            cv2.line(out, (bx, by), (bx + bracket_len, by), color_theme, 4)
            cv2.line(out, (bx, by), (bx, by + bracket_len), color_theme, 4)
            # Top-right
            cv2.line(out, (bx + bw, by), (bx + bw - bracket_len, by), color_theme, 4)
            cv2.line(out, (bx + bw, by), (bx + bw, by + bracket_len), color_theme, 4)
            # Bottom-left
            cv2.line(out, (bx, by + bh), (bx + bracket_len, by + bh), color_theme, 4)
            cv2.line(out, (bx, by + bh), (bx, by + bh - bracket_len), color_theme, 4)
            # Bottom-right
            cv2.line(out, (bx + bw, by + bh), (bx + bw - bracket_len, by + bh), color_theme, 4)
            cv2.line(out, (bx + bw, by + bh), (bx + bw, by + bh - bracket_len), color_theme, 4)

            # Label above head
            badge_text = f"{self.student_name} | {self.current_status}"
            cv2.rectangle(out, (bx, max(0, by - 26)), (bx + bw, by), color_theme, -1)
            cv2.putText(out, badge_text, (bx + 6, max(18, by - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 2)

        # 2. Draw 3D Nose Direction Arrow
        if nose_start and nose_end:
            # Nose circle
            cv2.circle(out, nose_start, 4, (0, 255, 255), -1)
            # 3D projected nose arrow vector
            cv2.arrowedLine(out, nose_start, nose_end, color_theme, 3, tipLength=0.25)
            # Label near nose arrow
            cv2.putText(out, "Nose Vector", (nose_end[0] + 5, nose_end[1]),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (220, 220, 220), 1)

        # 3. Top Banner (Dark Translucent Bar)
        overlay = out.copy()
        cv2.rectangle(overlay, (0, 0), (W, 46), (15, 15, 25), -1)
        cv2.addWeighted(overlay, 0.75, out, 0.25, 0, out)

        # Lecture & Session Info
        session_info = f"Lecture: {self.lecture_title} | Student: {self.student_name} ({self.student_roll})"
        cv2.putText(out, session_info, (14, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (230, 230, 230), 1)

        # Live Status Chip on right
        status_chip_color = (30, 200, 80) if is_attentive else (30, 60, 240)
        cv2.rectangle(out, (W - 170, 8), (W - 12, 38), status_chip_color, -1)
        chip_label = "ATTENTIVE" if is_attentive else "INATTENTIVE"
        cv2.putText(out, chip_label, (W - 155, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 2)

        # 4. Bottom Attentiveness & Pose HUD
        overlay_bottom = out.copy()
        cv2.rectangle(overlay_bottom, (0, H - 48), (W, H), (15, 15, 25), -1)
        cv2.addWeighted(overlay_bottom, 0.8, out, 0.2, 0, out)

        # Attentiveness percentage meter
        pct = self.attentiveness_percentage
        pct_color = (40, 220, 100) if pct >= 75 else ((0, 190, 255) if pct >= 50 else (40, 60, 240))
        pct_text = f"Attentiveness: {pct:.1f}% ({self.calculate_attendance_status(pct)})"
        cv2.putText(out, pct_text, (14, H - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, pct_color, 2)

        # Nose & Pose stats (Yaw / Pitch)
        pose_text = f"Nose Dir: Yaw {yaw:+.1f}deg | Pitch {pitch:+.1f}deg | {reason}"
        cv2.putText(out, pose_text, (W - 440, H - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (200, 210, 220), 1)

        return out

    def get_live_metrics(self) -> Dict[str, Any]:
        pct = self.get_attentiveness_percentage()
        attendance_status = self.calculate_attendance_status(pct)
        return {
            "is_active": self.is_active,
            "session_id": self.session_id,
            "lecture_title": self.lecture_title,
            "student_id": self.student_id,
            "student_name": self.student_name,
            "student_roll": self.student_roll,
            "current_status": self.current_status,
            "current_reason": self.current_reason,
            "yaw": self.current_yaw,
            "pitch": self.current_pitch,
            "roll": self.current_roll,
            "is_face_detected": self.is_face_detected,
            "total_frames": self.total_frames,
            "attentive_frames": self.attentive_frames,
            "inattentive_frames": self.inattentive_frames,
            "absent_frames": self.absent_frames,
            "attentiveness_percentage": pct,
            "attendance_status": attendance_status,
        }


# Global monitoring engine instance
monitoring_engine = AttentivenessEngine()
