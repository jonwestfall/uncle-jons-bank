# Developer Guide

This document provides a high-level overview of Uncle Jon's Bank for new contributors.

## Architecture

The project is composed of a **FastAPI** backend and a **React** frontend.

### Backend
- `app/main.py` bootstraps the FastAPI application, configures middleware and background tasks, and registers route modules.
- Database models live in `app/models.py` and use [SQLModel](https://sqlmodel.tiangolo.com/). These include `Loan`, `LoanTransaction`, and `ShareCode` for loan management and account sharing.
- Business logic and data access are centralized in `app/crud.py`.
- Pydantic request/response schemas reside under `app/schemas/`.
- Individual feature areas expose API routers in `app/routes/` (e.g. `children.py`, `transactions.py`, `loans.py`).

### Frontend
- `frontend/src/main.tsx` mounts the React application and manages global theming.
- `frontend/src/App.tsx` maintains authentication state and sets up client-side routing.

## Startup Sequence

1. `app/main.py` creates the FastAPI app and configures CORS.
2. On startup, `create_db_and_tables` ensures the SQLite database and schema exist.
3. The background `daily_interest_task` loop recalculates interest, processes fees, accrues loan interest and redeems matured CDs once per day.
4. Route handlers defined under `app/routes/` service HTTP requests.
5. The React frontend authenticates against `/auth/login` or `/auth/token` and then calls other endpoints with a JWT bearer token.

## Development Tips

- Install backend dependencies: `pip install -r backend/requirements.txt`.
- Run tests with `./tests/run` from the repository root.
- When modifying database models, adjust any related Pydantic schemas and run migrations if using a persistent DB.
- Keep heavy logic in `crud.py` to simplify route handlers and aid testing.

## File Layout

```
backend/app/
  main.py         # FastAPI application setup
  models.py       # SQLModel ORM models
  crud.py         # Database and business logic helpers
  routes/         # API endpoint definitions (children.py, transactions.py, loans.py)
  schemas/        # Pydantic request/response models
  tests/          # Backend test helpers
frontend/src/
  main.tsx        # React bootstrap and theming
  App.tsx         # Client-side routing and global state
```

## Testing

Run the Python test suite:

```bash
./tests/run
```

## Conventions

- Use asynchronous database sessions from `app.database.get_session` in route handlers.
- Add permissions in `app/acl.py` and seed them via `ensure_permissions_exist` on startup.
- Follow the module docstring style used throughout the repository for clarity.

