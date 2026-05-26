# LifeLens Backend

AI-powered daily activity journal backend. Users log their daily activities via text or voice, and AI analyzes behavioral patterns over time to deliver personalized insights and suggestions.

## Tech Stack

- **Framework:** Python / FastAPI (async)
- **Database:** PostgreSQL + pgvector (vector embeddings)
- **ORM:** SQLAlchemy 2.0 (async)
- **Migrations:** Alembic
- **Auth:** JWT (python-jose + bcrypt)
- **AI:** Instructor + LiteLLM (structured LLM output, provider-agnostic)

## Quick Start

```bash
# 1. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your database URL and API keys

# 4. Setup database
chmod +x scripts/setup_db.sh
./scripts/setup_db.sh

# 5. Run migrations
alembic upgrade head

# 6. Start the server
uvicorn app.main:app --reload --port 8000
```

## API Documentation

Once running, visit:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create a new account |
| POST | `/api/auth/login` | Login and get JWT token |
| GET | `/api/auth/me` | Get current user profile |

### Activities
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/activities` | Log a new activity |
| GET | `/api/activities` | List activities (paginated) |
| GET | `/api/activities/{id}` | Get single activity |
| DELETE | `/api/activities/{id}` | Delete an activity |
| POST | `/api/activities/search` | Semantic search |

### Insights
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/insights/daily` | Get daily AI insight |
| GET | `/api/insights/weekly` | Get weekly AI insight |
| GET | `/api/insights/history` | List past insights |
| POST | `/api/insights/ask` | Ask about your patterns |

## Project Structure

```
LifeLensBackend/
├── app/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Environment configuration
│   ├── database.py          # Async SQLAlchemy engine
│   ├── models/              # ORM models (User, Activity, Insight)
│   ├── schemas/             # Pydantic request/response models
│   ├── api/                 # Route handlers
│   ├── services/            # Business logic + AI orchestration
│   └── core/                # Security, dependencies
├── alembic/                 # Database migrations
├── scripts/                 # Setup scripts
├── requirements.txt
└── .env
```
