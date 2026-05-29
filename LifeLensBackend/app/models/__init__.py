"""
LifeLens — Models Package

Import all models here so Alembic and the app can discover them.
"""

from app.models.activity import Activity
from app.models.insight import Insight
from app.models.user import User
from app.models.user_settings import UserSettings

__all__ = ["User", "Activity", "Insight", "UserSettings"]
