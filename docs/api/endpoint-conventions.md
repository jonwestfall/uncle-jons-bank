# Endpoint Conventions

## Base path

- Frontend reaches API through reverse proxy path: `/api/*`.
- Backend route definitions are mounted at root (`/`), with Caddy rewriting `/api`.

## URI and verb conventions

- Noun collections: `GET /resource`, `POST /resource`
- Resource item: `GET /resource/{id}`, `PUT /resource/{id}`, `DELETE /resource/{id}`
- Action endpoints: `POST /resource/{id}/approve`, `POST /resource/{id}/deny`

## Payload conventions

- Request/response models are defined in `backend/app/schemas/*`.
- Money and rates are normalized by backend validation rules.
- Most mutations return updated domain object.

## Status code conventions

- `200`: successful read/update/create response body.
- `204`: successful mutation with no body (for example deletes/logout).
- `400`: business rule violation.
- `401`: invalid/expired/revoked token or invalid credentials.
- `403`: authenticated but not authorized.
- `404`: not found or hidden resource.
- `422`: request validation error.
- `500`: unhandled backend error.
