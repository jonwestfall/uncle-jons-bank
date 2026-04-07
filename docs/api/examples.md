# API Examples

## Register parent

```bash
curl -X POST http://localhost/api/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Parent A","email":"parent@example.com","password":"secret"}'
```

## Parent login

```bash
curl -X POST http://localhost/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"parent@example.com","password":"secret"}'
```

## Create child (authenticated)

```bash
curl -X POST http://localhost/api/children/ \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"first_name":"Sam","access_code":"SAM123","frozen":false}'
```

## Add transaction

```bash
curl -X POST http://localhost/api/transactions/ \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"child_id":1,"type":"credit","amount":10.00,"memo":"Allowance"}'
```

## Approve withdrawal

```bash
curl -X POST http://localhost/api/withdrawals/12/approve \
  -H "Authorization: Bearer $TOKEN"
```
