# Uncle Jon's Bank Frontend

React + TypeScript + Vite single-page app for parents, children, and admins.

## What this app contains

- Role-aware routes in `src/App.tsx` for:
  - Parent experience (`/`, `/parent/*`, `/messages`)
  - Child experience (`/child/*`)
  - Admin experience (`/admin*`)
- Feature API modules in `src/api/*`.
- Shared route-level fallback/error handling with `src/components/RouteBoundary.tsx`.
- Domain-focused dashboard hooks under `src/hooks/parentDashboard` and `src/hooks/childDashboard`.

## Prerequisites

- Node 20+
- npm 10+

## Local development

Install dependencies:

```bash
npm install
```

Start dev server:

```bash
npm run dev
```

Build production bundle:

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

Run lint checks:

```bash
npm run lint
```

## Environment configuration

The frontend reads API base URL from `VITE_API_URL`.

- Docker compose build sets `VITE_API_URL=/api` and expects Caddy proxy.
- Local direct backend runs typically use `VITE_API_URL=http://localhost:8000`.

Example:

```bash
VITE_API_URL=http://localhost:8000 npm run dev
```

## Everyday workflows

### Add a new API integration

1. Add typed request/response functions under `src/api/<feature>.ts`.
2. Reuse `createApiClient` from `src/api/client.ts`.
3. Handle failures with `toastApiError` from `src/utils/apiError.ts`.
4. Use the API function from page-level hook/component.

### Add a new route/page

1. Create page under `src/pages`.
2. Add lazy import + route in `src/App.tsx`.
3. Wrap route element with `RouteBoundary`.
4. Ensure route is exposed only to intended role(s).

### Update dashboard behavior

- Parent dashboard orchestration: `src/pages/ParentDashboard.tsx`
- Child dashboard orchestration: `src/pages/ChildDashboard.tsx`
- Keep heavy side-effect/data logic in hooks, not in large page JSX blocks.

## Related documentation

- Architecture and maps: `../docs/developer/architecture.md`
- Local setup and contributor flow: `../docs/developer/`
- API contract details: `../docs/api/`
