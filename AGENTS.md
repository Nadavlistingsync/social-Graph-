# Social Graph

Obsidian-style relationship network for warm intros. Frontend-only React + TypeScript + Vite app; all code and data live in `web/`. There is no backend or database — the graph is seeded from static data in `web/src/data/`.

## Cursor Cloud specific instructions

- The app lives entirely in `web/`. Run all `npm` commands from there.
- Standard commands are defined in `web/package.json`: `npm run dev` (Vite dev server on `http://localhost:5173`), `npm run build` (`tsc -b && vite build`), `npm run lint` (oxlint), `npm run preview`.
- No environment variables, secrets, or external services are required — it is purely client-side with seed data in `web/src/data/`.
- Dependencies are refreshed automatically by the startup update script (`npm install` in `web/`); no manual install is needed at session start.
