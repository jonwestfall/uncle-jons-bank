# Auth Model

## Token types

The API issues JWT pairs:

- Access token (`typ=access`)
- Refresh token (`typ=refresh`)

Tokens include claims: `sub`, `iss`, `aud`, `iat`, `nbf`, `exp`, `jti`, `typ`.

`sub` format:

- `user:{id}` for parent/admin identities
- `child:{id}` for child identities

## Login flows

- Parent/admin login: `POST /login` or `POST /token`
- Child login: `POST /children/login`
- Refresh: `POST /refresh`
- Logout/revocation: `POST /logout`

## Authorization model

- Role-level checks use `require_role(...)`.
- Permission-level checks use `require_permissions(...)`.
- Mixed user/child routes use `get_current_identity(...)`.

## Transport

Use bearer auth header:

`Authorization: Bearer <access_token>`
