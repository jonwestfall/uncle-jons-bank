# Incident Playbooks

## Severity model

- Sev 1: full outage or data integrity risk.
- Sev 2: major feature unavailable.
- Sev 3: degraded but workaround exists.

## 1. API outage

1. Confirm service/container status (`docker compose ps`, logs).
2. Validate `backend/.env` has required vars (especially `SECRET_KEY`).
3. Check backend logs for startup/runtime exception.
4. Roll back to last known-good image/commit if needed.
5. Confirm `/api/docs` and login flow recover.

## 2. Auth failures spike

1. Check token config changes (`SECRET_KEY`, issuer/audience, expiry).
2. Verify server time skew and JWT validation failures.
3. Review `/refresh` and `/logout` behavior in logs.
4. If caused by secret rotation, communicate forced re-login.

## 3. Scheduler not running daily jobs

1. Check `SCHEDULER_MODE`.
2. Inspect `scheduler_locks` and `job_runs` tables.
3. Run manual catch-up:

```bash
cd backend
python -m app.services.scheduler --force
```

4. Verify new `job_runs` records with success status.

## 4. Data corruption or bad deploy

1. Freeze writes (maintenance mode if available; otherwise stop backend).
2. Assess blast radius and time window.
3. Restore latest valid DB backup.
4. Verify critical flows and reconcile missing writes where possible.
5. Publish incident report with root cause and preventive actions.

## Post-incident requirements

- Add timeline, root cause, and action items.
- Update this runbook and related docs within the same remediation PR.
