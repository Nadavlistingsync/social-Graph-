# Social Graph

Warm-intro map. One question: **who do I know who can get me to this person?**

## Live

**https://social-graph-one.vercel.app**

Hard-refresh if you still see an old 404 (`Cmd/Ctrl + Shift + R`).

## Cloud sync (Supabase)

Already provisioned: private Storage bucket `user-graphs` + `/api/graph` sync endpoint.

**Vercel env vars**

Client (Vite):
- `VITE_SUPABASE_URL=https://YOUR_REF.supabase.co`
- `VITE_SUPABASE_ANON_KEY=` (anon JWT)

Server (API — never use `VITE_` for the service role):
- `SUPABASE_URL=` (same URL)
- `SUPABASE_SERVICE_ROLE_KEY=` (service_role JWT)

In Supabase Auth → URL configuration, add your Vercel origin to **Redirect URLs**.
For smoother signup, you can disable **Confirm email** under Auth providers.

Optional Postgres table (not required for sync): [`supabase/migrations/001_user_graphs.sql`](./supabase/migrations/001_user_graphs.sql).

## Local

```bash
npm run install:web   # or: cd web && npm install
npm run dev
```

Open http://localhost:5173

1. **Find path** — pick a target → see who to ask  
2. **Graph** — explore the network  
3. **Note** — open anyone; every link has a source  

## Deploy

Already connected to GitHub — pushes to `main` deploy automatically.

**Vercel settings that work:**
- Root Directory: leave **empty** (repo root), OR set to `web`
- If Root Directory is empty → uses root `vercel.json` (`web/dist`)
- If Root Directory is `web` → uses `web/vercel.json` (`dist`)
- No env vars required

Details: [PRODUCT.md](./PRODUCT.md)
