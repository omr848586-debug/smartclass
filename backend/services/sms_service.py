import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("smartclass.sms")

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")
SMS_ENABLED = os.getenv("SMS_ENABLED", "false").lower() in ["true", "1", "yes"]


def send_inattention_sms(
    student_name: str,
    phone_number: str,
    lecture_title: str,
    attentiveness_pct: float
) -> Dict[str, Any]:
    """
    Send an urgent SMS alert regarding inattentiveness during lecture.
    Falls back to simulated logging if SMS gateway is not configured.
    """
    if not phone_number:
        return {"status": "SKIPPED", "message": "No phone number provided"}

    message_body = (
        f"[SmartClass Alert] Attention Warning: Student {student_name} dropped to "
        f"{attentiveness_pct:.1f}% attentiveness in lecture '{lecture_title}'. "
        f"Minimum 75% required for attendance."
    )

    if not SMS_ENABLED or not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        logger.info(f"[SIMULATED SMS] Sent to {phone_number}: {message_body}")
        return {
            "status": "SENT_SIMULATED",
            "phone_number": phone_number,
            "message": f"Simulated SMS alert logged for {phone_number}"
        }

    try:
        from twilio.rest import Client
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            body=message_body,
            from_=TWILIO_PHONE_NUMBER,
            to=phone_number
        )
        logger.info(f"[LIVE SMS] Delivered message SID {msg.sid} to {phone_number}")
        return {
            "status": "SENT_LIVE",
            "message_sid": msg.sid,
            "phone_number": phone_number,
            "message": "Live SMS delivered successfully"
        }
    except Exception as e:
        logger.error(f"[SMS ERROR] Failed to send SMS: {e}")
        return {
            "status": "FAILED",
            "phone_number": phone_number,
            "message": f"SMS dispatch failed: {str(e)}"
        }
