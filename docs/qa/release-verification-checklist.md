# Release Verification Checklist

## Before release

- [ ] PR CI is green (formatting, lint, type-check, tests, coverage).
- [ ] Release notes/changelog entries are updated.
- [ ] Required docs changes are merged.
- [ ] DB or config changes include rollback notes.

## Staging verification

- [ ] Parent login works.
- [ ] Child login works.
- [ ] Parent dashboard loads without errors.
- [ ] Child dashboard loads without errors.
- [ ] Core ledger transaction flow works.
- [ ] Withdrawal request/approval flow works.
- [ ] Message/inbox page loads.
- [ ] Admin settings page loads and saves expected fields.

## Production verification

- [ ] App homepage and login load.
- [ ] API docs endpoint is reachable for operators.
- [ ] One end-to-end core journey is verified with test account.
- [ ] Error monitoring/log dashboards show no spike after deploy.
- [ ] Rollback owner and trigger threshold are confirmed.
