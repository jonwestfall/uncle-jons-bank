# Error Model

The API returns JSON for non-2xx responses.

## Error shapes

1. Canonical object errors:

```json
{"code":"auth_invalid_credentials","message":"Invalid email or password"}
```

2. HTTPException detail:

```json
{"detail":"Transaction amount must be greater than zero"}
```

3. Validation detail array:

```json
{"detail":[{"loc":["body","amount"],"msg":"Input should be greater than 0"}]}
```

## Client handling

- Treat HTTP status as source of truth.
- Prefer `code` when present.
- Classify `422` as request validation.
- Surface business-rule `detail` messages for user feedback.

See also: `backend/docs/api-error-contract.md`.
