import os
import smtplib
from email.message import EmailMessage
from pathlib import Path

import requests
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is not configured. Add it to the project root .env file.")
    return value


def _send_with_brevo(to_email: str, subject: str, text: str, html: str | None = None) -> None:
    api_key = _required("BREVO_API_KEY")
    sender_email = _required("BREVO_SENDER_EMAIL")
    sender_name = os.getenv("BREVO_SENDER_NAME", "VisionAttend AI").strip() or "VisionAttend AI"

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email}],
        "subject": subject,
        "textContent": text,
    }
    if html:
        payload["htmlContent"] = html

    print(f"[EMAIL] Sending via Brevo: sender={sender_email}, recipient={to_email}, subject={subject}")
    response = requests.post(
        BREVO_API_URL,
        headers={
            "accept": "application/json",
            "api-key": api_key,
            "content-type": "application/json",
        },
        json=payload,
        timeout=20,
    )
    print(f"[EMAIL] Brevo response status: {response.status_code}")
    if not response.ok:
        try:
            detail = response.json().get("message", response.text)
        except ValueError:
            detail = response.text
        print(f"[EMAIL] Brevo request failed: {response.status_code} - {detail}")
        raise RuntimeError(f"Brevo email request failed ({response.status_code}): {detail}")


def _send_with_smtp(to_email: str, subject: str, text: str, html: str | None = None) -> None:
    host = _required("SMTP_HOST")
    username = _required("SMTP_USERNAME")
    password = _required("SMTP_PASSWORD")
    sender = os.getenv("MAIL_FROM", username).strip() or username
    port = int(os.getenv("SMTP_PORT", "587"))
    use_ssl = os.getenv("SMTP_SSL", "false").strip().lower() == "true"

    message = EmailMessage()
    message["From"] = sender
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text)
    if html:
        message.add_alternative(html, subtype="html")

    if use_ssl:
        with smtplib.SMTP_SSL(host, port, timeout=20) as server:
            server.login(username, password)
            server.send_message(message)
    else:
        with smtplib.SMTP(host, port, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(username, password)
            server.send_message(message)


def send_email(to_email: str, subject: str, text: str, html: str | None = None) -> None:
    # Render Free cannot reliably use outbound SMTP. Prefer Brevo's HTTPS API
    # whenever a production API key is configured; keep SMTP for local fallback.
    if os.getenv("BREVO_API_KEY", "").strip():
        _send_with_brevo(to_email, subject, text, html)
        return
    _send_with_smtp(to_email, subject, text, html)
