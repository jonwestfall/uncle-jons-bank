# Local Setup

## Prerequisites

- Docker Desktop or Docker Engine + Compose
- Python 3.11+ (for direct backend runs)
- Node 20+ and npm (for direct frontend runs)

## Quick start (recommended)

1. Create `backend/.env` with required secrets (`SECRET_KEY` at minimum).
2. Start stack:

```bash
docker compose up --build
```

3. Open:
- App: `http://localhost`
- API docs: `http://localhost/api/docs`

## Run backend directly

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Run frontend directly

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL=http://localhost:8000` if frontend is run outside Docker.

## Test commands

- Full backend tests:

```bash
./tests/run
```

- Frontend formatting/lint/type-check/component tests:

```bash
cd frontend
npm run format:check
npm run lint
npm run typecheck
npm run test:component
```

- Frontend e2e smoke tests (against built app):

```bash
cd frontend
npm run build
npm run test:smoke
```
