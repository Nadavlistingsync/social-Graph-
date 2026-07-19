# Social Graph

Warm-intro map. One question: **who do I know who can get me to this person?**

## Live

**https://social-graph-one.vercel.app**

Hard-refresh if you still see an old 404 (`Cmd/Ctrl + Shift + R`).

## Cloud sync (Supabase)

Set on Vercel (and optionally in `web/.env.local`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (anon JWT or `sb_publishable_…`)

Apply the schema once: paste [`supabase/migrations/001_user_graphs.sql`](./supabase/migrations/001_user_graphs.sql) into the Supabase SQL Editor, **or** run with your secret key:

```bash
SUPABASE_URL=https://YOUR_REF.supabase.co SUPABASE_SECRET_KEY=sb_secret_… node web/scripts/apply-schema.mjs
```

In Supabase Auth → URL configuration, add your Vercel origin to **Redirect URLs**.

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
