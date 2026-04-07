# Developer Guide

This document provides a high-level overview of Uncle Jon's Bank for new contributors.

## Architecture

The project is composed of a **FastAPI** backend and a **React** frontend.

### Backend
- `app/main.py` bootstraps the FastAPI application, configures middleware and scheduler startup, and registers route modules.
- Database models live in `app/models.py` and use [SQLModel](https://sqlmodel.tiangolo.com/). These include `Loan`, `LoanTransaction`, `ShareCode`, `Coupon`, `CouponRedemption`, and `Settings` for site configuration.
- Business logic and data access are centralized in `app/crud.py`.
- Background scheduling orchestration lives under `app/services/` (`daily_jobs.py` and `scheduler.py`).
- Pydantic request/response schemas reside under `app/schemas/`.
- Individual feature areas expose API routers in `app/routes/` (e.g. `children.py`, `transactions.py`, `loans.py`, `coupons.py`, `settings.py`).

### Frontend
- `frontend/src/main.tsx` mounts the React application and manages global theming.
- `frontend/src/App.tsx` maintains authentication state and sets up client-side routing.
- `frontend/src/api/client.ts` is the shared HTTP client for auth header injection, JSON handling, and normalized API errors.
- `frontend/src/api/*.ts` modules contain endpoint-specific calls by feature (children, transactions, recurring, messages, etc.).
- `frontend/src/utils/apiError.ts` maps normalized API errors to user-facing toast messages.

## Startup Sequence

1. `app/main.py` creates the FastAPI app and configures CORS.
2. On startup, `create_db_and_tables` ensures the SQLite database and schema exist.
3. The scheduler (`app/services/scheduler.py`) elects a leader using a DB lock row and runs `app/services/daily_jobs.py` once per day.
4. Route handlers defined under `app/routes/` service HTTP requests.
5. The React frontend authenticates against `/auth/login` or `/auth/token` and then calls other endpoints with a JWT bearer token.

## Development Tips

- Install backend dependencies: `pip install -r backend/requirements.txt`.
- Run tests with `./tests/run` from the repository root.
- When modifying database models, adjust any related Pydantic schemas and run migrations if using a persistent DB.
- Keep heavy logic in `crud.py` to simplify route handlers and aid testing.
- See `backend/docs/scheduler-operations.md` for scheduler deployment and recovery runbooks.

## File Layout

```
backend/app/
  main.py         # FastAPI application setup
  models.py       # SQLModel ORM models
  crud.py         # Database and business logic helpers
  routes/         # API endpoint definitions (children.py, transactions.py, loans.py, coupons.py, settings.py)
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

## Frontend Endpoint Workflow

Use this flow when adding a new frontend endpoint:

1. Add a typed function in the correct feature module under `frontend/src/api/` (or create a new module if needed).
2. Keep page/component code free of raw `fetch`; create a client once per component via:
   - `const client = useMemo(() => createApiClient({ baseUrl: apiUrl, getToken: () => token }), [apiUrl, token])`
3. Call your feature function with that client, and wrap failures with:
   - `toastApiError(showToast, error, 'Fallback message')`
4. If the endpoint is public, create a client without `getToken`.
5. Keep response/payload types in the feature module so endpoint contracts stay centralized.

Example:

```ts
// frontend/src/api/widgets.ts
import type { ApiClient } from './client'

export interface Widget {
  id: number
  name: string
}

export const listWidgets = (client: ApiClient) =>
  client.get<Widget[]>('/widgets')
```

```ts
// in a page/component
const client = useMemo(
  () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
  [apiUrl, token],
)

try {
  const widgets = await listWidgets(client)
  setWidgets(widgets)
} catch (error) {
  toastApiError(showToast, error, 'Failed to load widgets')
}
```
