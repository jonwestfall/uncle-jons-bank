# Backups

## Data to back up

- Primary DB file: `backend/uncle_jons_bank.db`
- Recommended: keep app config (`backend/.env`) in secure secret storage (not in git backups)

## Backup frequency

- Minimum: daily backup + 14 days retention.
- Recommended: hourly snapshots for production usage.

## SQLite backup approach

For single-node compose deployments, stop writes and copy DB file:

```bash
docker compose stop backend
cp backend/uncle_jons_bank.db /path/to/backups/uncle_jons_bank-$(date +%F-%H%M).db
docker compose start backend
```

If downtime must be avoided, run SQLite online backup strategy in an app-maintenance window.

## Restore procedure

1. Stop backend service.
2. Replace `backend/uncle_jons_bank.db` with selected backup.
3. Start backend service.
4. Validate with login + ledger read checks.

## Restore drill cadence

- Run restore drill at least monthly.
- Record RTO/RPO and follow-up actions.
