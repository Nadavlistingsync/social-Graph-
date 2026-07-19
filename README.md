# Social Graph

Warm-intro map. One question: **who do I know who can get me to this person?**

## Live

**https://social-graph-one.vercel.app**

Hard-refresh if you still see an old 404 (`Cmd/Ctrl + Shift + R`).

## Cloud sync (Supabase)

Secrets stay in **server `.env` / Vercel env** — nothing Supabase-related is bundled into the frontend.

Copy [`.env.example`](./.env.example) → `.env` and fill in:

```bash
SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
```

Same three vars on Vercel (Production). Auth + sync go through `/api/auth` and `/api/graph`.

In Supabase Auth → URL configuration, add your Vercel origin to **Redirect URLs**.
Optional: disable **Confirm email** for smoother signup.

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
