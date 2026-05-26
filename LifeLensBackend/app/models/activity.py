"""
LifeLens — Activity Model

Stores user activity logs with AI-generated metadata and pgvector embeddings.
"""

import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import settings
from app.database import Base


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    category: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    mood: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    tags: Mapped[str | None] = mapped_column(
        Text,  # comma-separated tags
        nullable=True,
    )
    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    is_deleted: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    # pgvector embedding for semantic search
    embedding = mapped_column(
        Vector(settings.EMBEDDING_DIMENSIONS),
        nullable=True,
    )

    # Relationships
    user = relationship("User", back_populates="activities")

    # Indexes
    __table_args__ = (
        Index(
            "ix_activities_user_logged",
            "user_id",
            "logged_at",
        ),
    )

    def __repr__(self) -> str:
        return f"<Activity {self.id} by {self.user_id}>"
