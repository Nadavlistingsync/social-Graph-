# Social Graph

Warm-intro map. Frontend-only React + TypeScript + Vite app in `web/`. No backend — seed data in `web/src/data/`. Home route is Path Finder (`/`); graph is `/graph`.

## Cursor Cloud specific instructions

- The app lives entirely in `web/`. Prefer `npm run dev` / `npm run build` from repo root (proxies into `web/`), or run the same scripts inside `web/`.
- Node 20+ (see `.nvmrc`). No environment variables or secrets required.
- Dependencies: `npm run install:web` or `npm install` inside `web/`.
- Vercel: Root Directory `web` (recommended) or root `vercel.json` building `web/dist`.
