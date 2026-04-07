# Environment Matrix

| Area | Local Dev | CI (PR) | Staging | Production |
|---|---|---|---|---|
| Backend lint/format/type-check | Recommended before push | Required | Optional spot-check | N/A |
| Backend API tests | Recommended before push | Required | Required before release cut | N/A |
| Frontend lint/type-check | Recommended before push | Required | Optional spot-check | N/A |
| Frontend component tests | Recommended before push | Required | Optional spot-check | N/A |
| Frontend e2e smoke tests | Recommended for risky UI changes | Required | Required | Post-deploy verification |
| Manual release verification | Optional | N/A | Required | Required |

## Notes

- CI is the source of truth for merge gating.
- Staging release checks should use release candidates built from the exact commit SHA.
