# Scheduler Operations

This service supports two scheduler deployment models:

1. `SCHEDULER_MODE=leader` (default): every API replica runs the scheduler loop, but only the elected leader executes jobs.
2. `SCHEDULER_MODE=external`: API replicas do not run jobs in-process; trigger jobs with an external scheduler (cron, Kubernetes CronJob, ECS Scheduled Task, etc.).

## Data Model

The scheduler uses two tables:

- `scheduler_locks`: a single lock row (`name`, `owner_id`, `locked_until`, `updated_at`) for leader election.
- `job_runs`: execution history (`job_name`, `started_at`, `finished_at`, `status`, `error`).

Job names include:

- `daily_jobs_pipeline`
- `daily.recurring_charges`
- `daily.account_interest_and_fees`
- `daily.loan_interest`
- `daily.cd_redemptions`

## Environment Variables

- `SCHEDULER_MODE`: `leader` or `external` (default `leader`)
- `SCHEDULER_LOCK_NAME`: lock row key (default `daily_jobs_lock`)
- `SCHEDULER_OWNER_ID`: optional fixed worker id (auto-generated if unset)
- `SCHEDULER_POLL_SECONDS`: leader-loop poll interval (default `60`)
- `SCHEDULER_LOCK_TTL_SECONDS`: lock lease TTL in seconds (default `600`)

## Leader Mode Deployment

1. Deploy multiple API replicas with `SCHEDULER_MODE=leader`.
2. Ensure all replicas point to the same database.
3. Confirm only one active owner at a time by querying:

```sql
SELECT name, owner_id, locked_until, updated_at FROM scheduler_locks;
```

## External Scheduler Deployment

1. Set API replicas to `SCHEDULER_MODE=external`.
2. Configure your scheduler to run once per day:

```bash
cd backend
python -m app.services.scheduler
```

Use `--force` to run even if the pipeline already completed today.

## Recovery Procedures

### Job failed

1. Inspect failed runs:

```sql
SELECT job_name, started_at, finished_at, status, error
FROM job_runs
ORDER BY started_at DESC
LIMIT 50;
```

2. Fix underlying issue.
3. Re-run manually:

```bash
cd backend
python -m app.services.scheduler --force
```

The daily jobs are idempotent and safe to rerun.

### Leader appears stuck

If `locked_until` is in the past, any healthy worker will take over on next poll.

If needed, clear the stale lock row:

```sql
DELETE FROM scheduler_locks WHERE name = 'daily_jobs_lock';
```

Then either wait for the next poll (`leader` mode) or run manually (`external` mode).

### Verify successful recovery

```sql
SELECT job_name, started_at, finished_at, status
FROM job_runs
WHERE started_at >= datetime('now', '-1 day')
ORDER BY started_at DESC;
```
