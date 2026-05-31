"""
LifeLens — Auth Service

Business logic for user registration and login.
"""

from datetime import datetime, timedelta, timezone
import logging
import random

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.user import TokenResponse, UserCreate, UserResponse
from app.services.email_service import send_verification_email

logger = logging.getLogger(__name__)


async def register_user(db: AsyncSession, payload: UserCreate) -> TokenResponse:
    """
    Register a new user account.
    Raises ValueError if the email is already taken.
    """
    # Check for existing email
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none() is not None:
        raise ValueError("An account with this email already exists")

    # Create user
    now = datetime.now(timezone.utc)
    if payload.is_google:
        user = User(
            email=payload.email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
            email_verified=True,
        )
    else:
        # Standard registration: Generate OTP code
        code = f"{random.randint(100000, 999999)}"
        user = User(
            email=payload.email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
            email_verified=False,
            verification_code=code,
            verification_expires_at=now + timedelta(minutes=10),
            verification_sent_at=now,
            verification_attempts=0,
        )

    db.add(user)
    await db.flush()  # get the ID before commit

    # Send verification email if standard signup
    if not payload.is_google and user.verification_code:
        try:
            await send_verification_email(user.email, user.verification_code)
        except Exception as e:
            logger.error(f"Email delivery failed during registration for {user.email}: {e}")
            raise ValueError(f"Email delivery failed: {e}")

    # Generate token
    token = create_access_token(str(user.id))
    user_response = UserResponse.model_validate(user)

    return TokenResponse(access_token=token, user=user_response)


async def login_user(db: AsyncSession, email: str, password: str) -> TokenResponse:
    """
    Authenticate a user and return a JWT token.
    Raises ValueError if credentials are invalid.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.hashed_password):
        raise ValueError("Invalid email or password")

    if not user.is_active:
        raise ValueError("Account has been deactivated")

    # Prevent unverified sign-in attempts
    if not user.email_verified:
        raise ValueError("Please verify your email before signing in.")

    token = create_access_token(str(user.id))
    user_response = UserResponse.model_validate(user)

    return TokenResponse(access_token=token, user=user_response)
