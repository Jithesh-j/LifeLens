"""
LifeLens — User Schemas

Pydantic models for authentication request/response payloads.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


# ── Requests ──────────────────────────────────────────────────


class UserCreate(BaseModel):
    """Register a new user."""

    email: EmailStr
    password: str
    full_name: str
    is_google: bool = False


class UserLogin(BaseModel):
    """Login with email and password."""

    email: EmailStr
    password: str


class VerifyEmailRequest(BaseModel):
    """Payload to verify email address with OTP code."""

    email: EmailStr
    code: str


class ResendCodeRequest(BaseModel):
    """Payload to request code resend."""

    email: EmailStr


# ── Responses ─────────────────────────────────────────────────


class UserResponse(BaseModel):
    """Public user profile."""

    id: uuid.UUID
    email: str
    full_name: str
    email_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """JWT token after login."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
