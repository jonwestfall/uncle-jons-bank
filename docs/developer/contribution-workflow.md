# Contribution Workflow

## Branch and PR flow

1. Create a branch from latest `main`.
2. Implement change + tests.
3. Run checks locally (`./tests/run`, frontend format/lint/type-check/tests as needed).
4. Update docs (see checklist below).
5. Open PR with summary, risk notes, and test evidence.

CI quality gates on PRs:

- Formatting
- Lint
- Type-check
- Automated tests with minimum coverage thresholds

## PR template guidance

Include these sections in every PR description:

- Summary
- Why this change
- Testing performed
- Rollback plan
- Docs impact
- Release notes impact

## Docs checklist (required)

- [ ] User guide updated for user-visible behavior changes.
- [ ] API docs updated for endpoint/auth/error changes.
- [ ] Developer docs updated for architecture/setup/workflow changes.
- [ ] Ops docs updated for deployment/env/runbook changes.

If none apply, add: `Docs impact: none (no behavior or contract changes)`.
