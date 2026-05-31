"""
LifeLens — Auth API Routes

Endpoints for user registration, login, and profile.
"""

from datetime import datetime, timezone, timedelta
import random

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
    VerifyEmailRequest,
    ResendCodeRequest,
)
from app.services.auth_service import login_user, register_user
from app.services.email_service import send_verification_email

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new account",
)
async def register(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Register a new user and return a JWT token."""
    try:
        return await register_user(db, payload)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with email and password",
)
async def login(
    payload: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate a user and return a JWT token."""
    try:
        return await login_user(db, payload.email, payload.password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


@router.post(
    "/verify",
    response_model=TokenResponse,
    summary="Verify email address with OTP code",
)
async def verify_email(
    payload: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Validate 6-digit OTP code, activate account, and sign in."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )

    if user.email_verified:
        from app.core.security import create_access_token
        token = create_access_token(str(user.id))
        return TokenResponse(access_token=token, user=UserResponse.model_validate(user))

    # Expired check
    now = datetime.now(timezone.utc)
    if not user.verification_expires_at or user.verification_expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code expired. Request a new code.",
        )

    # Attempts check (Brute force protection)
    if user.verification_attempts >= 5:
        user.verification_code = None
        user.verification_expires_at = None
        user.verification_sent_at = None
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many failed attempts. Please request a new verification code.",
        )

    # Match check
    if user.verification_code != payload.code:
        user.verification_attempts += 1
        await db.commit()
        
        # Double check if this attempt triggered the brute force lockout
        if user.verification_attempts >= 5:
            user.verification_code = None
            user.verification_expires_at = None
            user.verification_sent_at = None
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many failed attempts. Please request a new verification code.",
            )
            
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code.",
        )

    # Valid code: verify user and clear OTP fields
    user.email_verified = True
    user.verification_code = None
    user.verification_expires_at = None
    user.verification_sent_at = None
    user.verification_attempts = 0
    await db.commit()
    await db.refresh(user)

    from app.core.security import create_access_token
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post(
    "/resend-code",
    summary="Resend verification OTP code",
)
async def resend_code(
    payload: ResendCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate a new OTP verification code and dispatch it."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )

    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already verified.",
        )

    # Rate limiting: Maximum 1 resend every 60 seconds
    now = datetime.now(timezone.utc)
    if user.verification_sent_at and (now - user.verification_sent_at) < timedelta(seconds=60):
        remaining_seconds = 60 - int((now - user.verification_sent_at).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {remaining_seconds} seconds before requesting a new code.",
        )

    # Generate new code
    code = f"{random.randint(100000, 999999)}"
    user.verification_code = code
    user.verification_expires_at = now + timedelta(minutes=10)
    user.verification_sent_at = now
    user.verification_attempts = 0
    await db.commit()

    try:
        await send_verification_email(user.email, code)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send verification email: {e}",
        )

    return {"detail": "Verification code sent successfully."}


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Return the authenticated user's profile."""
    return UserResponse.model_validate(current_user)
