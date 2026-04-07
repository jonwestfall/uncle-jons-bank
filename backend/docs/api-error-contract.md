# API Error Contract

This API returns non-2xx responses as JSON. Clients should treat the HTTP status as authoritative and parse the payload as described below.

## Response Shapes

### 1. Canonical object errors
Used by authentication flows and unhandled server errors.

```json
{
  "code": "auth_invalid_credentials",
  "message": "Invalid email or password"
}
```

### 2. FastAPI HTTP errors
Used by route-level business rule checks.

```json
{
  "detail": "Transaction amount must be greater than zero"
}
```

### 3. FastAPI validation errors
Used when request body/path/query fails schema validation.

```json
{
  "detail": [
    {
      "type": "literal_error",
      "loc": ["body", "type"],
      "msg": "Input should be 'credit' or 'debit'",
      "input": "bonus"
    }
  ]
}
```

## Canonical Error Codes

When a `code` field is present, clients should use it directly. For `detail`-only errors, use the canonical code mapping below.

| Canonical code | HTTP status | Trigger |
|---|---:|---|
| `request_validation_error` | `422` | Pydantic/FastAPI schema validation failed |
| `domain_invalid_amount` | `400` | Amount violates domain rules (for example, zero/over-limit payment) |
| `domain_invalid_rate` | `400` | Interest/penalty rate outside allowed business range |
| `auth_invalid_credentials` | `401` | Invalid login credentials |
| `auth_account_pending` | `403` | Account exists but is not active |
| `forbidden` | `403` | Authenticated but insufficient permission |
| `not_found` | `404` | Resource does not exist or is not visible to caller |
| `conflict` | `409` | Request conflicts with existing resource state |
| `internal_server_error` | `500` | Unexpected unhandled server error |

## Domain Rules Enforced by 400 Responses

The following business-rule violations return `400` with a `detail` message:

- Transaction amount must be greater than zero.
- Loan payment amount must be greater than zero.
- Loan payment amount cannot exceed principal remaining.
- CD amount must be greater than zero.
- Withdrawal amount must be greater than zero.
- Interest and penalty rates must be bounded to `[0, 1]`.

## Client Handling Guidance

- Always branch on HTTP status first.
- If payload has `code`, treat it as the machine-readable identifier.
- Else if status is `422`, classify as `request_validation_error` and surface field-level issues from `detail`.
- Else classify by status plus `detail` text using the canonical mapping table above.
