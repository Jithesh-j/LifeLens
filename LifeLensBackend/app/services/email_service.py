"""
LifeLens — Email Service

Handles sending email verification codes using production-ready providers:
SMTP (Gmail App Password, custom hosts), Resend, SendGrid, and Postmark.
"""

import logging
import smtplib
import json
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


async def send_verification_email(email: str, code: str) -> None:
    """
    Sends the 6-digit OTP code to the user's email using the configured EMAIL_PROVIDER.
    Supports retry logic (3 attempts) with exponential backoff for transient failures.
    
    If email delivery fails, raises a descriptive Exception so that registration/resend
    can propagate the failure cleanly and roll back if necessary.
    """
    provider = settings.EMAIL_PROVIDER.lower() if settings.EMAIL_PROVIDER else "smtp"
    subject = "Verify Your AuraJournal Account"
    
    body = (
        f"Welcome to AuraJournal!\n\n"
        f"Your verification code is:\n\n"
        f"{code}\n\n"
        f"This code expires in 10 minutes.\n\n"
        f"If you did not create this account, please ignore this email."
    )

    # Security constraint: Only log verification codes in local development logs (settings.DEBUG is True)
    if settings.DEBUG:
        box_width = 60
        divider = "*" * box_width
        empty_line = "*" + " " * (box_width - 2) + "*"
        
        def pad_line(text: str) -> str:
            content_width = box_width - 4
            return f"* {text.ljust(content_width)} *"

        logger.info("\n" + divider)
        logger.info(pad_line("📧 AURAJOURNAL EMAIL SERVICE — OUTBOX"))
        logger.info(divider)
        logger.info(pad_line(f"TO:      {email}"))
        logger.info(pad_line(f"SUBJECT: {subject}"))
        logger.info(divider)
        logger.info(empty_line)
        logger.info(pad_line("Welcome to AuraJournal!"))
        logger.info(empty_line)
        logger.info(pad_line("Your verification code is:"))
        logger.info(pad_line(f"🔑 [  {code}  ]"))
        logger.info(empty_line)
        logger.info(pad_line("This code expires in 10 minutes."))
        logger.info(empty_line)
        logger.info(pad_line("If you did not create this account, please ignore this email."))
        logger.info(empty_line)
        logger.info(divider + "\n")

    # Validate provider configuration before dispatching
    if provider == "smtp":
        if not settings.SMTP_HOST or not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
            raise ValueError(
                "SMTP delivery configuration is incomplete. "
                "Ensure SMTP_HOST, SMTP_USERNAME, and SMTP_PASSWORD are defined in your env."
            )
    elif provider == "resend":
        if not settings.RESEND_API_KEY:
            raise ValueError("Resend API key is missing. Ensure RESEND_API_KEY is defined in your env.")
    elif provider == "sendgrid":
        if not settings.SENDGRID_API_KEY:
            raise ValueError("SendGrid API key is missing. Ensure SENDGRID_API_KEY is defined in your env.")
    elif provider == "postmark":
        if not settings.POSTMARK_API_TOKEN:
            raise ValueError("Postmark Server Token is missing. Ensure POSTMARK_API_TOKEN is defined in your env.")
    else:
        raise ValueError(
            f"Unknown EMAIL_PROVIDER: '{provider}'. "
            f"Supported providers are: smtp, resend, sendgrid, postmark"
        )

    max_attempts = 3
    last_error = None

    import asyncio

    for attempt in range(1, max_attempts + 1):
        try:
            logger.info(f"Attempting email delivery to {email} using {provider.upper()} (Attempt {attempt}/{max_attempts})...")
            
            if provider == "smtp":
                await _send_via_smtp(email, subject, body)
            elif provider == "resend":
                await _send_via_resend(email, subject, body)
            elif provider == "sendgrid":
                await _send_via_sendgrid(email, subject, body)
            elif provider == "postmark":
                await _send_via_postmark(email, subject, body)
            
            # Successful send log matching the requested behavior: "Verification email successfully sent to: user@example.com"
            logger.info(f"Verification email successfully sent to: {email}")
            return
            
        except Exception as e:
            last_error = e
            logger.warning(f"Attempt {attempt} failed to deliver email: {e}")
            if attempt < max_attempts:
                # Exponential backoff (1s, 2s)
                await asyncio.sleep(attempt)
    
    # Exceeded retries, fail with meaningful error
    logger.error(f"Email delivery system failed permanently after {max_attempts} attempts for {email}. Error: {last_error}")
    raise last_error


async def _send_via_smtp(email: str, subject: str, body: str) -> None:
    """Delivers real email via custom SMTP connection or Gmail App Password."""
    import asyncio
    
    def sync_send():
        msg = MIMEMultipart()
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        
        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAIL_FROM, email, msg.as_string())
        except smtplib.SMTPAuthenticationError as auth_err:
            raise RuntimeError(f"SMTP Authentication Error: {auth_err}")
        except smtplib.SMTPConnectError as conn_err:
            raise RuntimeError(f"SMTP Connection Error: {conn_err}")
        except Exception as e:
            raise RuntimeError(f"SMTP Error: {e}")
            
    await asyncio.to_thread(sync_send)


async def _send_via_resend(email: str, subject: str, body: str) -> None:
    """Delivers real email via Resend API."""
    import httpx
    
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": settings.EMAIL_FROM,
        "to": [email],
        "subject": subject,
        "text": body
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code not in (200, 201, 202):
                logger.error(f"Resend API Response Error (HTTP {response.status_code}): {response.text}")
                raise RuntimeError(f"Resend API Error: {response.status_code} - {response.text}")
        except httpx.RequestError as req_err:
            raise RuntimeError(f"Resend Network Connection Error: {req_err}")


async def _send_via_sendgrid(email: str, subject: str, body: str) -> None:
    """Delivers real email via SendGrid API."""
    import httpx
    
    url = "https://api.sendgrid.com/v3/mail/send"
    headers = {
        "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "personalizations": [{
            "to": [{"email": email}]
        }],
        "from": {"email": settings.EMAIL_FROM, "name": "AuraJournal"},
        "subject": subject,
        "content": [{"type": "text/plain", "value": body}]
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code not in (200, 201, 202):
                logger.error(f"SendGrid API Response Error (HTTP {response.status_code}): {response.text}")
                raise RuntimeError(f"SendGrid API Error: {response.status_code} - {response.text}")
        except httpx.RequestError as req_err:
            raise RuntimeError(f"SendGrid Network Connection Error: {req_err}")


async def _send_via_postmark(email: str, subject: str, body: str) -> None:
    """Delivers real email via Postmark API."""
    import httpx
    
    url = "https://api.postmarkapp.com/email"
    headers = {
        "X-Postmark-Server-Token": settings.POSTMARK_API_TOKEN,
        "Content-Type": "application/json"
    }
    payload = {
        "From": settings.EMAIL_FROM,
        "To": email,
        "Subject": subject,
        "TextBody": body
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code not in (200, 201, 202):
                logger.error(f"Postmark API Response Error (HTTP {response.status_code}): {response.text}")
                raise RuntimeError(f"Postmark API Error: {response.status_code} - {response.text}")
        except httpx.RequestError as req_err:
            raise RuntimeError(f"Postmark Network Connection Error: {req_err}")
