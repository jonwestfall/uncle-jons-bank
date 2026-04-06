# Security Operations

## Required Environment Variables

Set these for every backend deployment:

- `SECRET_KEY`: Required signing key for JWTs. Startup fails immediately if missing.
- `JWT_ALGORITHM`: JWT signing algorithm. Default: `HS256`.
- `JWT_ISSUER`: Expected JWT issuer claim. Default: `uncle-jons-bank`.
- `JWT_AUDIENCE`: Expected JWT audience claim. Default: `uncle-jons-bank-api`.
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Access token lifetime in minutes. Default: `30`.
- `REFRESH_TOKEN_EXPIRE_MINUTES`: Refresh token lifetime in minutes. Default: `20160` (14 days).

Example (`backend/.env`):

```env
SECRET_KEY=replace-with-long-random-secret
JWT_ALGORITHM=HS256
JWT_ISSUER=uncle-jons-bank
JWT_AUDIENCE=uncle-jons-bank-api
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=20160
```

## JWT Claims in Use

Access and refresh tokens include and validate these claims:

- `sub`: Stable identity key (`user:{id}` or `child:{id}`)
- `iss`, `aud`: Issuer and audience checks
- `iat`, `nbf`, `exp`: Issued-at, not-before, expiration checks
- `jti`: Unique token id for revocation checks
- `typ`: Token type (`access` or `refresh`)

## Token Revocation and Logout

- Revoked tokens are stored server-side in the `revokedtoken` table.
- `POST /logout` revokes the caller's access token and, if provided, refresh token.
- `POST /refresh` rotates refresh tokens (old refresh token is revoked before issuing a new one).
- Any request using a revoked token is rejected with `401`.

## Secret Rotation Procedure

Use this process when rotating `SECRET_KEY`:

1. Generate a new random secret and update `SECRET_KEY` in deployment configuration.
2. Redeploy the backend so new tokens are signed with the new key.
3. Invalidate active sessions by asking users to re-authenticate.
4. Verify old tokens are rejected (signature mismatch) and fresh logins succeed.
5. Optionally clear expired rows from `revokedtoken` periodically.

Operational note: a single-key rotation invalidates all existing JWTs immediately, including refresh tokens.
