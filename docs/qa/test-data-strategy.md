# Test Data Strategy

## Goals

- Keep tests deterministic and isolated.
- Minimize shared mutable state across tests.
- Make it easy to reproduce defects using known fixtures.

## Data sources

- **Backend integration tests**: use in-memory SQLite and test-created entities per test scenario.
- **Frontend component tests**: use component-local mocks/stubs; avoid external API dependencies.
- **E2E smoke tests**: validate UI shell and core route behavior that does not require seeded production-like data.

## Data rules

- Each test must arrange only data it needs.
- Avoid depending on test execution order.
- Reuse helper builders/factories when available.
- If persistent test routes are used for manual QA (`ENABLE_TEST_ROUTES=true`), disable them after setup.

## Sensitive data policy

- Never use real personal or financial data in tests.
- Use synthetic emails (`example.com`), fake names, and non-sensitive values.
