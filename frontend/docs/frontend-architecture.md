# Frontend Architecture

## Parent Dashboard Feature Boundaries

The `ParentDashboard` page is now a coordinator that composes focused feature modules.

### Page orchestration
- `frontend/src/pages/ParentDashboard.tsx`
- Owns cross-feature wiring, modal visibility for edit flows, and permission-derived capability flags.
- Composes hooks and leaf components rather than embedding API logic or large UI sections.

### Hooks ownership
- `frontend/src/hooks/parentDashboard/useChildren.ts`
- Owns child list retrieval, child enrichment (balance + activity), add-child flow, freeze/unfreeze flow.

- `frontend/src/hooks/parentDashboard/useLedger.ts`
- Owns ledger state, selected child context, transaction creation, and transaction deletion.

- `frontend/src/hooks/parentDashboard/useRecurring.ts`
- Owns recurring charge loading, creation, and deletion for a selected child.

- `frontend/src/hooks/parentDashboard/useWithdrawals.ts`
- Owns pending withdrawals list loading and approval/denial workflows.

- `frontend/src/hooks/parentDashboard/useShareAccess.ts`
- Owns share/access state and API workflows: share codes, code redemption, access code updates, and parent access management.

### Component ownership
- `frontend/src/components/parentDashboard/WithdrawalsPanel.tsx`
- Presentational rendering for pending withdrawals and actions.

- `frontend/src/components/parentDashboard/ChildList.tsx`
- Presentational rendering for child cards and primary actions.

- `frontend/src/components/parentDashboard/LedgerPanel.tsx`
- Ledger workspace for transaction table, transaction creation, recurring creation, and CD offer form.

- `frontend/src/components/parentDashboard/RecurringChargesPanel.tsx`
- Focused recurring charge list and edit/delete actions.

- `frontend/src/components/parentDashboard/ShareAccessManagement.tsx`
- Action modal tabs plus share/access-related modal surfaces.

## Child Dashboard Feature Boundaries

The `ChildDashboard` page now follows the same orchestration-first pattern.

### Page orchestration
- `frontend/src/pages/ChildDashboard.tsx`
- Owns cross-feature coordination, confirm-action modal wiring, and hook composition.

### Hooks ownership
- `frontend/src/hooks/childDashboard/useChildLedger.ts`
- Owns ledger loading and loading-state behavior.

- `frontend/src/hooks/childDashboard/useChildProfile.ts`
- Owns child profile lookup for dashboard title context.

- `frontend/src/hooks/childDashboard/useChildWithdrawals.ts`
- Owns withdrawal list loading plus create/cancel request workflows.

- `frontend/src/hooks/childDashboard/useChildRecurring.ts`
- Owns recurring charge retrieval.

- `frontend/src/hooks/childDashboard/useChildCds.ts`
- Owns CD offer retrieval and CD accept/reject/redeem workflows.

### Component ownership
- `frontend/src/components/childDashboard/ChildLedgerSection.tsx`
- Presents account header, balance, ledger table, and loans guidance copy.

- `frontend/src/components/childDashboard/ChildRecurringPanel.tsx`
- Presents recurring transfer summaries.

- `frontend/src/components/childDashboard/ChildCdOffersPanel.tsx`
- Presents CD offers and delegated user actions.

- `frontend/src/components/childDashboard/ChildWithdrawalsPanel.tsx`
- Presents withdrawal request form and request history/actions.

## Shared Domain Types

Shared frontend domain models live in:
- `frontend/src/types/domain.ts`

These types are consumed by API modules, page hooks, and UI components to keep shape definitions centralized.

## Route-Level Resilience

Routes are wrapped in a reusable boundary:
- `frontend/src/components/RouteBoundary.tsx`

Responsibilities:
- `Suspense` loading fallback for lazily loaded route modules.
- Error boundary fallback for route subtree rendering failures.

`frontend/src/App.tsx` lazy-loads page modules and wraps each route element with `RouteBoundary`.
