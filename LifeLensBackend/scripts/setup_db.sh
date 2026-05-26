#!/bin/bash
# ──────────────────────────────────────────────
# LifeLens — Database Setup Script
#
# Creates the 'lifelens' database and enables
# the pgvector extension for embedding storage.
# ──────────────────────────────────────────────

set -e

DB_USER="${PGUSER:-postgres}"
DB_NAME="lifelens"

echo "🗄️  LifeLens Database Setup"
echo "──────────────────────────"

# Create database (ignore error if it already exists)
echo "📦 Creating database '$DB_NAME'..."
psql -U "$DB_USER" -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 \
  && echo "   Database '$DB_NAME' already exists." \
  || (psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" && echo "   ✅ Database created.")

# Enable pgvector extension
echo "🔌 Enabling pgvector extension..."
psql -U "$DB_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS vector;" \
  && echo "   ✅ pgvector extension enabled."

echo ""
echo "✅ Database setup complete!"
echo "   Connection: postgresql://$DB_USER@localhost:5432/$DB_NAME"
echo ""
echo "Next steps:"
echo "   1. Run migrations: alembic upgrade head"
echo "   2. Start the server: uvicorn app.main:app --reload --port 8000"
