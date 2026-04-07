# Deployment

## Topology

Docker Compose runs three services:

- `backend` (FastAPI, port 8000 internal)
- `frontend` (Nginx static build)
- `caddy` (public port 80, reverse proxy to frontend and backend)

## Deploy with Docker Compose

```bash
docker compose up --build -d
```

## Post-deploy verification

- `GET /` returns frontend.
- `GET /api/` returns API welcome payload.
- `GET /api/docs` loads Swagger UI.
- Validate login and one representative mutation path.

## Scheduler deployment modes

- `SCHEDULER_MODE=leader` (default): one elected API replica runs jobs.
- `SCHEDULER_MODE=external`: run jobs from external scheduler via `python -m app.services.scheduler`.

See `backend/docs/scheduler-operations.md` for deep scheduler runbook details.
