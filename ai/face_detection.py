import cv2
import numpy as np
from typing import List, Tuple, Optional

# Load Haar Cascade face detector
HAAR_FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")


def detect_faces(frame: np.ndarray) -> List[Tuple[int, int, int, int]]:
    """
    Detect faces in a BGR frame.
    Returns list of bounding boxes as (x, y, w, h).
    """
    if frame is None or frame.size == 0:
        return []

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    faces = HAAR_FACE_CASCADE.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(60, 60),
        flags=cv2.CASCADE_SCALE_IMAGE
    )

    result = []
    for (x, y, w, h) in faces:
        result.append((int(x), int(y), int(w), int(h)))
    return result


def extract_face_crop(frame: np.ndarray, bbox: Tuple[int, int, int, int]) -> Optional[np.ndarray]:
    """Extract a cropped face image with safe margins"""
    x, y, w, h = bbox
    H, W = frame.shape[:2]
    # Add 10% padding
    pad_w = int(w * 0.1)
    pad_h = int(h * 0.1)
    x1 = max(0, x - pad_w)
    y1 = max(0, y - pad_h)
    x2 = min(W, x + w + pad_w)
    y2 = min(H, y + h + pad_h)
    crop = frame[y1:y2, x1:x2]
    return crop if crop.size > 0 else None
