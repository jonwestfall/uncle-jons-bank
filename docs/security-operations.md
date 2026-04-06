# Security Operations: Authentication Tokens

This document describes production auth configuration and JWT key rotation for Uncle Jon's Bank.

## Required environment variables

Set these in all non-local environments:

- `SECRET_KEY` (**required**): HMAC signing key for JWTs. The API now fails startup if this is missing.
- `JWT_ISSUER` (recommended, default: `uncle-jons-bank`): expected `iss` claim.
- `JWT_AUDIENCE` (recommended, default: `uncle-jons-bank-api`): expected `aud` claim.
- `ACCESS_TOKEN_EXPIRE_MINUTES` (optional, default: `30`): access token lifetime.
- `REFRESH_TOKEN_EXPIRE_MINUTES` (optional, default: `20160` / 14 days): refresh token lifetime.

## Claims enforced by the API

All tokens are signed with `HS256` and validated against:

- `sub` (`user:{id}` or `child:{id}`)
- `iss`
- `aud`
- `iat`
- `nbf`
- `exp`
- `jti`
- `type` (`access` or `refresh`)

## Refresh + revocation model

- `/login`, `/token`, and `/children/login` return both access and refresh tokens.
- `/refresh` rotates refresh tokens (old refresh token is revoked immediately).
- `/logout` revokes the current access token and optionally the matching refresh token.
- Revoked `jti` values are persisted in the `revokedtoken` table and rejected on all authenticated requests.

## Rotation procedure for `SECRET_KEY`

Because this project currently uses symmetric signing (`HS256`), key rotation invalidates all outstanding tokens.

1. **Prepare maintenance window** and notify users that re-authentication will be required.
2. **Generate a new strong random key** and store it in your secret manager.
3. **Update `SECRET_KEY`** in deployment configuration.
4. **Restart API instances** so startup validation picks up the new key.
5. **Force logout behavior** (optional but recommended): call `/logout` for active sessions if you track them externally.
6. **Verify**:
   - Old tokens return `401`.
   - New logins receive valid access + refresh tokens.
   - `/refresh` and `/logout` continue to work.

## Incident response (suspected token compromise)

1. Rotate `SECRET_KEY` immediately.
2. Invalidate all sessions (users must log in again).
3. Review access logs for suspicious use of `/refresh` and privileged endpoints.
4. Shorten token lifetimes temporarily via env vars until incident is resolved.
