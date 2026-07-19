# Social Graph

Warm-intro map. Frontend React + TypeScript + Vite app in `web/`. Supabase sync via `/api`. Seed data in `web/src/data/`. Home is Network (`/`); Find intro is `/find`.

## Cursor Cloud specific instructions

- The app lives entirely in `web/`. Prefer `npm run dev` / `npm run build` from repo root (proxies into `web/`), or run the same scripts inside `web/`.
- Node 20+ (see `.nvmrc`). Local secrets in gitignored `.env` (`SUPABASE_*`).
- Dependencies: `npm run install:web` or `npm install` inside `web/`.
- Vercel: Root Directory empty (repo root `vercel.json`) or `web`.
