import os
import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Load env variables manually from .env
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
print(f"Loading env from: {env_path}")

configs = {}
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                configs[key.strip()] = val.strip()

email_provider = configs.get("EMAIL_PROVIDER", "smtp")
email_from = configs.get("EMAIL_FROM")
smtp_host = configs.get("SMTP_HOST")
smtp_port = int(configs.get("SMTP_PORT", "587"))
smtp_username = configs.get("SMTP_USERNAME")
smtp_password = configs.get("SMTP_PASSWORD")

print("--- SMTP Configuration Loaded ---")
print(f"EMAIL_PROVIDER: {email_provider}")
print(f"EMAIL_FROM:     {email_from}")
print(f"SMTP_HOST:      {smtp_host}")
print(f"SMTP_PORT:      {smtp_port}")
print(f"SMTP_USERNAME:  {smtp_username}")
print(f"SMTP_PASSWORD:  {'********' if smtp_password else 'None'}")
print("---------------------------------")

if email_provider != "smtp":
    print(f"Error: active provider is '{email_provider}', not 'smtp'. Cannot run SMTP test.")
    sys.exit(1)

if not smtp_host or not smtp_username or not smtp_password or not email_from:
    print("Error: SMTP configurations are incomplete in .env.")
    sys.exit(1)

# Construct message
test_recipient = smtp_username # Send to self for verification
msg = MIMEMultipart()
msg["From"] = email_from
msg["To"] = test_recipient
msg["Subject"] = "LifeLens SMTP Verification Diagnostic"

body = (
    "Hello from LifeLens Diagnostic Script!\n\n"
    "This email verifies that your SMTP relay configuration is 100% functional.\n\n"
    "Connection and Authentication completed successfully."
)
msg.attach(MIMEText(body, "plain"))

print(f"Attempting to send diagnostic email to: {test_recipient}...")

try:
    print(f"Connecting to SMTP server at {smtp_host}:{smtp_port}...")
    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
        server.set_debuglevel(1) # Enable verbose SMTP logging
        
        print("Sending EHLO...")
        server.ehlo()
        
        print("Starting TLS session...")
        server.starttls()
        
        print("Sending EHLO after TLS...")
        server.ehlo()
        
        print(f"Logging in with user: {smtp_username}...")
        server.login(smtp_username, smtp_password)
        
        print(f"Sending mail from '{email_from}' to '{test_recipient}'...")
        server.sendmail(email_from, test_recipient, msg.as_string())
        
        print("✅ Email sent successfully without any errors!")
except smtplib.SMTPAuthenticationError as auth_err:
    print(f"\n❌ SMTP Authentication Failure: {auth_err}")
    print("Suggestion: Please verify your Gmail App Password. Standard Gmail passwords are not supported; you must generate a 16-character App Password under your Google Account Security settings.")
except smtplib.SMTPConnectError as conn_err:
    print(f"\n❌ SMTP Connection Failure: {conn_err}")
    print("Suggestion: Could not establish connection. Check your internet connection or if your network/firewall is blocking outbound connections on port 587.")
except Exception as e:
    print(f"\n❌ Unexpected SMTP Failure: {e}")
    if "sender address" in str(e).lower() or "530" in str(e):
        print("Suggestion: The SMTP From address (EMAIL_FROM) might be rejected by the SMTP server. Try changing EMAIL_FROM in your .env to match SMTP_USERNAME exactly.")
