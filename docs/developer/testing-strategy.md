# Testing Strategy And Pyramid

This repo follows a layered test pyramid so we catch regressions quickly and keep feedback loops fast.

## Test pyramid (from highest volume to lowest volume)

1. **Backend unit tests for CRUD/business rules**
- Scope: pure logic in `backend/app/crud.py`, money math, permission rules, and service helper functions.
- Goal: highest volume and fastest runtime.
- Expectation: every bug fix should add or update at least one unit-level assertion where feasible.

2. **Backend API integration tests**
- Scope: FastAPI routes and end-to-end request handling with in-memory DB/session overrides.
- Current location: `backend/app/tests/`.
- Goal: validate auth, permissions, response payloads, and route-level business behavior.

3. **Frontend component tests**
- Scope: React component behavior and conditional rendering.
- Current location: `frontend/src/components/__tests__/`.
- Runner: Vitest + Testing Library.
- Goal: protect UI-level branching and user-visible states without full browser automation cost.

4. **End-to-end smoke tests for core user journeys**
- Scope: basic path validation in a real browser against built frontend.
- Current location: `frontend/e2e/smoke/`.
- Runner: Playwright.
- Core smoke journey baseline:
  - App can load login route.
  - Role-mode switch (child/parent) works.
  - Critical form controls are visible for login.

## PR quality gates

The CI pipeline on pull requests runs:

- Formatting checks.
- Lint checks.
- Type-check checks.
- Automated tests with minimum coverage thresholds.

Current backend lint profile uses correctness-focused Ruff rules (`E9/F63/F7/F82`) as an immediate merge gate while broader style cleanup is incrementally rolled out.

Workflow file: `.github/workflows/ci.yml`.

## Coverage policy

- Backend integration suite enforces minimum total coverage with `--cov-fail-under=70`.
- Frontend component suite enforces minimum thresholds in `frontend/vitest.config.ts`.
- Thresholds should be ratcheted up over time; do not lower without an explicit team decision.
