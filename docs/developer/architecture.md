# Architecture

## System Context Diagram

```mermaid
flowchart LR
  U[Parent/Child/Admin Browser] --> FE[React SPA Frontend]
  FE -->|/api via Caddy| RP[Caddy Reverse Proxy]
  RP --> BE[FastAPI Backend]
  BE --> DB[(SQLite DB)]
  BE --> SCH[In-process Scheduler]
  SCH --> DB
```

## Backend Module Map

```mermaid
flowchart TD
  MAIN[app/main.py] --> ROUTES[app/routes/*]
  MAIN --> AUTH[app/auth.py]
  MAIN --> ACL[app/acl.py]
  MAIN --> SCHED[app/services/scheduler.py]

  ROUTES --> CRUD[app/crud.py]
  ROUTES --> SCHEMAS[app/schemas/*]
  ROUTES --> AUTH

  CRUD --> MODELS[app/models.py]
  CRUD --> DB[app/database.py]

  SCHED --> DAILY[app/services/daily_jobs.py]
  DAILY --> CRUD
  DB --> SQL[(SQLite uncle_jons_bank.db)]
```

## Frontend Route And Component Map

```mermaid
flowchart TD
  APP[src/App.tsx] --> AUTHR[Auth Routes]
  APP --> PARENTR[Parent Routes]
  APP --> CHILDR[Child Routes]
  APP --> ADMINR[Admin Routes]

  AUTHR --> LOGIN[LoginPage]
  AUTHR --> REGISTER[RegisterPage]

  PARENTR --> PD[ParentDashboard]
  PARENTR --> PP[ParentProfile]
  PARENTR --> PL[ParentLoans]
  PARENTR --> PC[ParentCoupons]
  PARENTR --> PCH[ParentChores]
  PARENTR --> MSG[Messages]

  CHILDR --> CD[ChildDashboard]
  CHILDR --> CP[ChildProfile]
  CHILDR --> CL[ChildLoans]
  CHILDR --> CC[ChildCoupons]
  CHILDR --> CCH[ChildChores]
  CHILDR --> BANK[ChildBank101]
  CHILDR --> MSG

  ADMINR --> AP[AdminPanel]
  ADMINR --> AC[AdminCoupons]

  PD --> PCHOOKS[parentDashboard hooks/*]
  CD --> CDHOOKS[childDashboard hooks/*]
  APP --> SHARED[shared components + api client]
```

## Notes

- Reverse proxy serves frontend at `/` and API at `/api/*`.
- Backend startup creates/updates schema and starts scheduler depending on env settings.
- Route modules are thin controllers; business logic is centralized in `app/crud.py`.
