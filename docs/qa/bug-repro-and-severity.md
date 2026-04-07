# Bug Reproduction Template And Severity Guidelines

## How to reproduce bugs (template)

Use this in issue bodies or incident notes:

- **Title**: short summary
- **Environment**: local / CI / staging / production
- **Account type**: parent / child / admin
- **Build/version**: commit SHA or release tag
- **Preconditions**: any setup required
- **Steps to reproduce**:
  1. ...
  2. ...
  3. ...
- **Expected result**: what should happen
- **Actual result**: what happened
- **Frequency**: always / intermittent / once
- **Evidence**: screenshot, logs, API response, console errors
- **Regression?**: yes/no/unknown and known good version

## Triage severity guidelines

- **Sev 1 (Critical)**
  - Production outage, data loss/corruption risk, security exposure, or login blocked for most users.
  - Response target: immediate triage and same-day fix/mitigation.

- **Sev 2 (High)**
  - Core feature broken for a meaningful user segment with no practical workaround.
  - Response target: prioritize current sprint/hotfix queue.

- **Sev 3 (Medium)**
  - Non-core workflow issues, partial degradation, or clear workaround exists.
  - Response target: schedule in next planned iteration.

- **Sev 4 (Low)**
  - Cosmetic issues, minor copy/layout defects, low impact edge cases.
  - Response target: backlog, batch with similar UX polish work.
