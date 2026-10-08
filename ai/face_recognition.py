import cv2
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from ai.face_detection import detect_faces, extract_face_crop
from ai.student_verification import compute_face_features, compare_features


class FaceRecognitionEngine:
    """
    Identifies detected classroom faces against the registered student roster
    and associates student identities with attentiveness tracks.
    """

    def __init__(self):
        self.known_students: List[Dict[str, Any]] = []

    def load_known_students(self, students_data: List[Dict[str, Any]]):
        """
        Loads registered students with their feature embeddings into memory
        for fast multi-student identification in video frames.
        """
        self.known_students = []
        for s in students_data:
            if s.get("face_encoding"):
                try:
                    import json
                    features = json.loads(s["face_encoding"])
                    self.known_students.append({
                        "id": s["id"],
                        "name": s["name"],
                        "roll_number": s["roll_number"],
                        "features": features
                    })
                except Exception:
                    continue

    def identify_face(self, face_crop: np.ndarray) -> Tuple[Optional[Dict[str, Any]], float]:
        """
        Matches a single cropped face against all registered student face profiles.
        Returns (student_dict, confidence) or (None, 0.0) if unmatched.
        """
        if face_crop is None or len(self.known_students) == 0:
            return None, 0.0

        live_features = compute_face_features(face_crop)
        if not live_features:
            return None, 0.0

        best_match = None
        best_confidence = 0.0

        for student in self.known_students:
            is_match, conf = compare_features(live_features, student["features"])
            if is_match and conf > best_confidence:
                best_confidence = conf
                best_match = student

        return best_match, best_confidence

    def recognize_frame_faces(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detects all faces in a frame and identifies known students.
        Returns bounding boxes with student identity annotations.
        """
        faces = detect_faces(frame)
        results = []
        for bbox in faces:
            crop = extract_face_crop(frame, bbox)
            student, confidence = self.identify_face(crop)
            results.append({
                "bbox": bbox,
                "student": student,
                "confidence": confidence,
                "is_recognized": student is not None
            })
        return results


# Global recognition engine
face_recognition_engine = FaceRecognitionEngine()
