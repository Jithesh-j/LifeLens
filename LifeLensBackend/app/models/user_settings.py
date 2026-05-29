"""
LifeLens — User Settings Model

Stores user settings (toggles, frequencies) for multi-user isolation.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    location_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    smart_activity_detection: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    smart_notifications: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    weather_on_timeline: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    notification_frequency: Mapped[str] = mapped_column(
        String(50),
        default="instant",
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="settings")

    def __repr__(self) -> str:
        return f"<UserSettings user_id={self.user_id}>"
