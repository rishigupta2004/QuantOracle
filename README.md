# QuantOracle

## Quick Start

1. **Create virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys (optional for Phase 1)
   ```

3. **Setup PostgreSQL database:**
   ```bash
   createdb quantoracle
   python scripts/init_db.py
   ```

4. **Run application:**
   ```bash
   ./run.sh
   ```

## Access Points

- **API Server:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **Frontend:** http://localhost:8501

## Project Structure

```
quantoracle/
├── app/
│   ├── main.py           # FastAPI entry point
│   ├── core/             # Configuration & database
│   ├── models/           # SQLAlchemy models & Pydantic schemas
│   └── api/              # API endpoints
├── frontend/
│   └── app.py            # Streamlit dashboard
├── scripts/
│   └── init_db.py        # Database initialization
├── tests/                # Unit tests
├── requirements.txt      # Dependencies
└── .env.example          # Environment template
```

## Phase 1 Progress

- [x] Project structure
- [x] FastAPI backend
- [x] YFinance integration
- [x] PostgreSQL models
- [x] Streamlit frontend (Dashboard)
- [ ] Unit tests
- [ ] Integration test with PostgreSQL
# QuantOracle
