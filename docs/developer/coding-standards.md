# Coding Standards

## Backend

- Keep route files in `backend/app/routes` focused on request validation and auth.
- Keep business rules and data mutations in `backend/app/crud.py`.
- Use shared auth dependencies from `backend/app/auth.py` (`require_role`, `require_permissions`, `get_current_identity`).
- Use schema models under `backend/app/schemas` for request/response contracts.
- Return explicit HTTP status codes and stable JSON error payloads.

## Frontend

- Keep endpoint calls in `frontend/src/api/*.ts`; avoid ad hoc `fetch` in pages when a feature API module exists.
- Use page-level hooks under `frontend/src/hooks/*` for data/workflow orchestration.
- Keep presentational sections in reusable components under `frontend/src/components/*`.
- Wrap route elements with `RouteBoundary` for Suspense + error handling.
- Use `toastApiError` for consistent user-facing API error messaging.

## General

- Prefer small, focused PRs.
- Add or update tests for behavior changes.
- Update docs in the same PR when behavior/contracts/process change.
