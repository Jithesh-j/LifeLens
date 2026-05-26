"""
LifeLens — Auth Service

Business logic for user registration and login.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.user import TokenResponse, UserCreate, UserResponse


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
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    await db.flush()  # get the ID before commit

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

    token = create_access_token(str(user.id))
    user_response = UserResponse.model_validate(user)

    return TokenResponse(access_token=token, user=user_response)
