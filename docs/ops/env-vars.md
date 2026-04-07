# Environment Variables

## Required

- `SECRET_KEY`: required for JWT signing.

## Security/Auth

- `JWT_ALGORITHM` (default `HS256`)
- `JWT_ISSUER` (default `uncle-jons-bank`)
- `JWT_AUDIENCE` (default `uncle-jons-bank-api`)
- `ACCESS_TOKEN_EXPIRE_MINUTES` (default `30`)
- `REFRESH_TOKEN_EXPIRE_MINUTES` (default `20160`)

## Runtime and CORS

- `ENV` (`development` or production-like values)
- `CORS_ALLOWED_ORIGINS` (strict list outside development)
- `LOG_LEVEL` (default `INFO`)
- `SQL_ECHO` (`true`/`false`)

## Scheduler

- `SCHEDULER_MODE` (`leader` or `external`)
- `SCHEDULER_LOCK_NAME`
- `SCHEDULER_OWNER_ID`
- `SCHEDULER_POLL_SECONDS`
- `SCHEDULER_LOCK_TTL_SECONDS`

## Test-only

- `ENABLE_TEST_ROUTES` (must be `false` in production)

## Frontend

- `VITE_API_URL` (build-time API base URL)
