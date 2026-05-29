import asyncio
import sys
import os

# Adjust path to import backend app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import text
from app.database import engine

async def add_column():
    print("🚀 Running database migration to add 'weather_on_timeline' column...")
    async with engine.begin() as conn:
        # Check if table exists and column exists
        await conn.execute(text("""
            ALTER TABLE user_settings 
            ADD COLUMN IF NOT EXISTS weather_on_timeline BOOLEAN DEFAULT FALSE;
        """))
    print("✅ Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(add_column())
