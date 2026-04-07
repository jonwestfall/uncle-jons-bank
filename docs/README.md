# Documentation Hub

This folder contains product, engineering, API, and operations documentation for Uncle Jon's Bank.

## Structure

- `docs/user-guide/`: end-user docs for parents, children, and admins.
- `docs/developer/`: architecture, setup, standards, and contribution flow.
- `docs/qa/`: test strategy artifacts, environment matrix, release verification.
- `docs/api/`: auth model, endpoint conventions, error model, and examples.
- `docs/ops/`: deployment, environment config, backups, and incident playbooks.

## Documentation Ownership

| Area | Primary owner | Backup owner | Review cadence |
|---|---|---|---|
| `docs/user-guide` | Product + Frontend maintainers | Support/admin maintainer | Every release |
| `docs/developer` | Backend + Frontend maintainers | Tech lead | Every release |
| `docs/api` | Backend maintainers | Frontend maintainer | Every API change |
| `docs/ops` | Ops/infra maintainer | Backend maintainer | Monthly + after incidents |

Update ownership rows when team assignments change.

## Definition Of Done (Docs Included)

A change is not done until all applicable items below are complete:

- [ ] User-facing behavior changes are reflected in `docs/user-guide`.
- [ ] API contract changes are reflected in `docs/api`.
- [ ] Architecture or module boundary changes are reflected in `docs/developer/architecture.md`.
- [ ] Local setup or contributor workflow changes are reflected in `docs/developer`.
- [ ] Deployment/env/backup/runbook changes are reflected in `docs/ops`.
- [ ] Release notes entry is prepared (see `docs/developer/versioning-and-releases.md`).
- [ ] If no docs update is needed, PR explains why in a `Docs impact` note.
