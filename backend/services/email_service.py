import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Load any .env variables on module startup
load_dotenv()

logger = logging.getLogger("smartclass.email")

def get_env_path() -> str:
    """Get absolute path to root .env file"""
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


def get_smtp_config() -> Dict[str, Any]:
    """Dynamically get the current SMTP configuration"""
    load_dotenv(get_env_path(), override=False)
    return {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", "").strip(),
        "password": os.getenv("SMTP_PASSWORD", "").strip(),
        "from_email": os.getenv("SMTP_FROM_EMAIL", "alerts@smartclass.edu").strip(),
        "enabled": os.getenv("SMTP_ENABLED", "false").lower() in ["true", "1", "yes"]
    }


def get_smtp_config_safe() -> Dict[str, Any]:
    """Get sanitized SMTP configuration safe for client display"""
    cfg = get_smtp_config()
    return {
        "host": cfg["host"],
        "port": cfg["port"],
        "user": cfg["user"],
        "from_email": cfg["from_email"] or cfg["user"],
        "enabled": cfg["enabled"],
        "has_password": bool(cfg["password"])
    }


def save_smtp_config(
    host: str,
    port: int,
    user: str,
    password: Optional[str],
    from_email: Optional[str],
    enabled: bool
) -> Dict[str, Any]:
    """Save SMTP configuration to environment and persist into .env file"""
    env_path = get_env_path()
    
    # Read existing .env lines if file exists
    env_lines = {}
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line_clean = line.strip()
                    if line_clean and not line_clean.startswith("#") and "=" in line_clean:
                        k, v = line_clean.split("=", 1)
                        env_lines[k.strip()] = v.strip()
        except Exception as e:
            logger.warning(f"Could not read existing .env file: {e}")

    # Set new values
    clean_host = host.strip() or "smtp.gmail.com"
    clean_user = user.strip()
    clean_from = (from_email or "").strip() or clean_user or "alerts@smartclass.edu"
    
    env_lines["SMTP_HOST"] = clean_host
    env_lines["SMTP_PORT"] = str(port)
    env_lines["SMTP_USER"] = clean_user
    if password is not None and password.strip():
        env_lines["SMTP_PASSWORD"] = password.strip()
        os.environ["SMTP_PASSWORD"] = password.strip()
    elif "SMTP_PASSWORD" not in env_lines and os.getenv("SMTP_PASSWORD"):
        env_lines["SMTP_PASSWORD"] = os.getenv("SMTP_PASSWORD", "").strip()

    env_lines["SMTP_FROM_EMAIL"] = clean_from
    env_lines["SMTP_ENABLED"] = "true" if enabled else "false"

    # Update runtime environment
    os.environ["SMTP_HOST"] = env_lines["SMTP_HOST"]
    os.environ["SMTP_PORT"] = env_lines["SMTP_PORT"]
    os.environ["SMTP_USER"] = env_lines["SMTP_USER"]
    os.environ["SMTP_FROM_EMAIL"] = env_lines["SMTP_FROM_EMAIL"]
    os.environ["SMTP_ENABLED"] = env_lines["SMTP_ENABLED"]

    # Write back to .env
    try:
        with open(env_path, "w", encoding="utf-8") as f:
            for k, v in env_lines.items():
                f.write(f"{k}={v}\n")
    except Exception as e:
        logger.error(f"Failed to persist .env file: {e}")

    return get_smtp_config_safe()


def send_inattention_alert_email(
    student_name: str,
    student_email: str,
    parent_email: Optional[str],
    lecture_title: str,
    attentiveness_pct: float,
    reason: str,
    detected_time: str
) -> Dict[str, Any]:
    """
    Send an automated HTML warning email to an inattentive student (and optionally parent).
    If SMTP is disabled or unconfigured, returns 'SENT_SIMULATED' status.
    If SMTP is configured and enabled, sends real email over SMTP via TLS/SSL.
    """
    cfg = get_smtp_config()
    
    is_critical = attentiveness_pct < 50.0
    subject = (
        f"🚨 [CRITICAL ALERT] Attentiveness Below 50% ({attentiveness_pct:.1f}%) in {lecture_title}"
        if is_critical
        else f"⚠️ [SmartClass Alert] Inattentiveness Detected in {lecture_title}"
    )
    
    recipients = [student_email]
    if parent_email and parent_email.strip():
        recipients.append(parent_email.strip())

    badge_text = "🚨 Critical Attention Alert: Below 50%" if is_critical else "Inattention Warning Triggered"
    badge_style = "background: #fee2e2; color: #991b1b; font-weight: 800; padding: 8px 18px; border-radius: 20px; font-size: 14px; border: 1px solid #f87171;"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fb; margin: 0; padding: 20px; }}
        .card {{ max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border-top: 5px solid {'#dc2626' if is_critical else '#f59e0b'}; }}
        .header {{ background: #1e1b4b; padding: 25px; text-align: center; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px; }}
        .content {{ padding: 30px; color: #334155; line-height: 1.6; }}
        .badge {{ display: inline-block; {badge_style} }}
        .stats-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0; }}
        .stat-row {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 15px; }}
        .stat-label {{ color: #64748b; font-weight: 500; }}
        .stat-val {{ font-weight: 700; color: #0f172a; }}
        .footer {{ background: #f1f5f9; padding: 18px; text-align: center; font-size: 13px; color: #64748b; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>SmartClass Attentiveness Monitoring</h1>
        </div>
        <div class="content">
          <p>Dear <strong>{student_name}</strong>,</p>
          <p>During the ongoing lecture <strong>"{lecture_title}"</strong>, the SmartClass AI Attention Tracking system detected that your attentiveness score has fallen to <strong>{attentiveness_pct:.1f}%</strong>.</p>
          
          <div style="text-align: center; margin: 20px 0;">
            <span class="badge">{badge_text}</span>
          </div>

          <div class="stats-box">
            <div class="stat-row">
              <span class="stat-label">Subject / Lecture:</span>
              <span class="stat-val">{lecture_title}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Current Attentiveness:</span>
              <span class="stat-val" style="color: #dc2626;">{attentiveness_pct:.1f}%</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Reason Detected:</span>
              <span class="stat-val">{reason}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Time of Detection:</span>
              <span class="stat-val">{detected_time}</span>
            </div>
          </div>

          <p>Please refocus your attention onto the lecture screen. Note that automated attendance credit requires maintaining at least <strong>75% attentiveness</strong>.</p>
        </div>
        <div class="footer">
          This is an automated notification from the SmartClass AI Monitoring System.
        </div>
      </div>
    </body>
    </html>
    """

    # Check if real live SMTP is enabled and configured
    if not cfg["enabled"] or not cfg["user"] or not cfg["password"]:
        missing_fields = []
        if not cfg["enabled"]:
            missing_fields.append("SMTP is Disabled")
        if not cfg["user"]:
            missing_fields.append("Sender Email is empty")
        if not cfg["password"]:
            missing_fields.append("Password is empty")
        
        reason_msg = ", ".join(missing_fields)
        logger.info(f"[SIMULATED EMAIL ALERT] ({reason_msg}) Sent to {recipients}: Inattention in '{lecture_title}' ({attentiveness_pct}%)")
        return {
            "status": "SENT_SIMULATED",
            "recipients": recipients,
            "subject": subject,
            "message": f"Simulated mode active ({reason_msg}). No real email sent over the internet. Configure SMTP settings in Alert Center to enable live delivery."
        }

    try:
        from_addr = cfg["from_email"] or cfg["user"]
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = ", ".join(recipients)
        msg.attach(MIMEText(html_content, "html"))

        # Port 465 uses SSL directly; Port 587 or 25 uses STARTTLS
        if cfg["port"] == 465:
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=12) as server:
                server.login(cfg["user"], cfg["password"])
                server.sendmail(from_addr, recipients, msg.as_string())
        else:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=12) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(cfg["user"], cfg["password"])
                server.sendmail(from_addr, recipients, msg.as_string())

        logger.info(f"[LIVE EMAIL ALERT] Successfully sent via SMTP ({cfg['host']}) to {recipients}")
        return {
            "status": "SENT_LIVE",
            "recipients": recipients,
            "subject": subject,
            "message": f"Real email alert successfully delivered to {', '.join(recipients)} via {cfg['host']}"
        }
    except smtplib.SMTPAuthenticationError as e:
        err_str = str(e)
        logger.error(f"[EMAIL AUTH ERROR] SMTP Authentication failed: {err_str}")
        user_msg = "SMTP Authentication Failed: Invalid email or password."
        if "gmail" in cfg["host"].lower():
            user_msg += " For Gmail: You must generate and use a 16-character 'Google App Password' (myaccount.google.com/apppasswords) with 2-Step Verification enabled, NOT your standard Gmail login password."
        return {
            "status": "FAILED",
            "recipients": recipients,
            "subject": subject,
            "message": user_msg
        }
    except Exception as e:
        logger.error(f"[EMAIL ERROR] Failed to send email via SMTP: {e}")
        return {
            "status": "FAILED",
            "recipients": recipients,
            "subject": subject,
            "message": f"SMTP delivery failed ({type(e).__name__}): {str(e)}"
        }
