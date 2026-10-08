import cv2
import json
import base64
import numpy as np
from typing import Tuple, Optional
from ai.face_detection import detect_faces, extract_face_crop


def compute_face_features(image_bgr: np.ndarray) -> Optional[list]:
    """
    Extract normalized facial feature vector with auto face-crop and illumination invariance.
    """
    if image_bgr is None or image_bgr.size == 0:
        return None

    # Step 1: Detect and crop the primary face in the image to remove background noise
    faces = detect_faces(image_bgr)
    if faces:
        # Pick largest detected face
        faces.sort(key=lambda b: b[2] * b[3], reverse=True)
        crop = extract_face_crop(image_bgr, faces[0])
        target_img = crop if (crop is not None and crop.size > 0) else image_bgr
    else:
        target_img = image_bgr

    # Resize face to canonical 128x128
    resized = cv2.resize(target_img, (128, 128))
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    gray_eq = cv2.equalizeHist(gray)

    # 1. Color histogram (Hue and Saturation)
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    hist_h = cv2.calcHist([hsv], [0], None, [32], [0, 180])
    hist_s = cv2.calcHist([hsv], [1], None, [32], [0, 256])
    cv2.normalize(hist_h, hist_h)
    cv2.normalize(hist_s, hist_s)

    # 2. Gradient / texture descriptors (Sobel on illumination-equalized face)
    grad_x = cv2.Sobel(gray_eq, cv2.CV_32F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(gray_eq, cv2.CV_32F, 0, 1, ksize=3)
    magnitude = cv2.magnitude(grad_x, grad_y)
    cv2.normalize(magnitude, magnitude)

    # Sample grid features (16x16)
    grid_features = cv2.resize(magnitude, (16, 16)).flatten()

    # Combine into single feature vector
    features = np.concatenate([
        hist_h.flatten(),
        hist_s.flatten(),
        grid_features
    ]).astype(float).tolist()

    return features


def compare_features(feat1: list, feat2: list) -> Tuple[bool, float]:
    """
    Compare two facial feature vectors using cosine similarity.
    Returns (is_match, confidence_score).
    """
    if not feat1 or not feat2 or len(feat1) != len(feat2):
        return False, 0.0

    v1 = np.array(feat1, dtype=np.float32)
    v2 = np.array(feat2, dtype=np.float32)

    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)

    if norm1 == 0 or norm2 == 0:
        return False, 0.0

    cosine_sim = float(np.dot(v1, v2) / (norm1 * norm2))
    confidence = max(0.0, min(1.0, cosine_sim))

    # Match threshold
    is_match = confidence >= 0.65
    return is_match, round(confidence, 4)


def decode_base64_image(base64_str: str) -> Optional[np.ndarray]:
    """Helper to convert base64 data URI to OpenCV BGR image"""
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
        img_bytes = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception:
        return None


def encode_image_to_base64(image_bgr: np.ndarray) -> str:
    """Helper to convert OpenCV image to base64 JPEG data URL"""
    try:
        ret, buffer = cv2.imencode(".jpg", image_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if not ret:
            return ""
        b64 = base64.b64encode(buffer).decode("utf-8")
        return f"data:image/jpeg;base64,{b64}"
    except Exception:
        return ""
