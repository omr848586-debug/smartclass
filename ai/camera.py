import cv2
import time
import threading
import numpy as np
from typing import Optional, Tuple


class CameraManager:
    """
    Unified camera & stream capture manager.
    Supports:
    1. Local Webcams (Index 0, 1, ...)
    2. RTSP/IP CCTV Streams (e.g. rtsp://192.168.1.100:554/stream)
    3. Google Meet / Screen Share Frames (Pushed from frontend via WebSocket/HTTP)
    """

    def __init__(self):
        self.cap: Optional[cv2.VideoCapture] = None
        self.source_type: str = "WEBCAM"  # "WEBCAM", "RTSP", "GOOGLE_MEET", "SIMULATED"
        self.source_url: Optional[str] = None
        self.camera_index: int = 0
        self.lock = threading.Lock()
        self.running: bool = False
        self.latest_frame: Optional[np.ndarray] = None
        self.latest_pushed_frame: Optional[np.ndarray] = None
        self.capture_thread: Optional[threading.Thread] = None
        self.is_connected: bool = False
        self.error_message: Optional[str] = None

    def start_source(self, source_type: str = "WEBCAM", source_url: Optional[str] = None, camera_index: int = 0) -> bool:
        self.stop_source()
        self.source_type = source_type.upper()
        self.source_url = source_url
        self.camera_index = camera_index
        self.running = True
        self.error_message = None

        if self.source_type in ["WEBCAM", "RTSP"]:
            src = self.source_url if self.source_type == "RTSP" and self.source_url else self.camera_index
            try:
                # Use DSHOW on Windows for webcams for fast startup and reliability
                if self.source_type == "WEBCAM" and isinstance(src, int):
                    self.cap = cv2.VideoCapture(src, cv2.CAP_DSHOW)
                else:
                    self.cap = cv2.VideoCapture(src)

                if self.cap and self.cap.isOpened():
                    self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    self.is_connected = True
                else:
                    # Fallback to default backend
                    if self.source_type == "WEBCAM" and isinstance(src, int):
                        self.cap = cv2.VideoCapture(src)
                        if self.cap and self.cap.isOpened():
                            self.is_connected = True
                        else:
                            self.is_connected = False
                            self.error_message = f"Could not open camera {src}. Falling back to simulation."
                    else:
                        self.is_connected = False
                        self.error_message = f"Could not open RTSP stream at {src}."
            except Exception as e:
                self.is_connected = False
                self.error_message = f"Camera init error: {str(e)}"

            # Start background frame reader thread
            self.capture_thread = threading.Thread(target=self._capture_worker, daemon=True)
            self.capture_thread.start()

        elif self.source_type == "GOOGLE_MEET":
            self.is_connected = True
            # Frames will be provided via push_external_frame()
            self.capture_thread = threading.Thread(target=self._push_worker, daemon=True)
            self.capture_thread.start()

        return True

    def push_external_frame(self, frame: np.ndarray):
        """Used by Google Meet / Screen Capture streams pushed from frontend"""
        with self.lock:
            self.latest_pushed_frame = frame
            self.latest_frame = frame

    def _capture_worker(self):
        while self.running:
            if self.cap and self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret and frame is not None:
                    with self.lock:
                        self.latest_frame = frame
                else:
                    time.sleep(0.03)
            else:
                # Generate a simulated test frame with camera notice
                dummy = self._generate_simulated_frame("Camera not accessible / reconnecting...")
                with self.lock:
                    self.latest_frame = dummy
                time.sleep(0.05)

    def _push_worker(self):
        while self.running:
            with self.lock:
                if self.latest_pushed_frame is None:
                    dummy = self._generate_simulated_frame("Waiting for Google Meet screen share stream...")
                    self.latest_frame = dummy
            time.sleep(0.05)

    def _generate_simulated_frame(self, message: str) -> np.ndarray:
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        # Gradient background
        for y in range(480):
            frame[y, :] = (int(25 + y * 0.05), int(20 + y * 0.03), int(45 + y * 0.08))

        # Grid lines
        cv2.line(frame, (0, 240), (640, 240), (40, 40, 60), 1)
        cv2.line(frame, (320, 0), (320, 480), (40, 40, 60), 1)

        # Centered message
        cv2.putText(frame, "SmartClass AI Camera Feed", (160, 200),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 215, 255), 2)
        cv2.putText(frame, message, (120, 240),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)
        cv2.putText(frame, f"Source: {self.source_type}", (20, 450),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 220, 100), 1)
        return frame

    def get_frame(self) -> Optional[np.ndarray]:
        with self.lock:
            if self.latest_frame is not None:
                return self.latest_frame.copy()
        return None

    def stop_source(self):
        self.running = False
        if self.capture_thread and self.capture_thread.is_alive():
            self.capture_thread.join(timeout=1.0)
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        self.is_connected = False


# Global camera instance
camera_manager = CameraManager()
