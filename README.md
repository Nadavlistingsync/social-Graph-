# Social Graph

Warm-intro map. One question: **who do I know who can get me to this person?**

## Local

```bash
npm run install:web   # or: cd web && npm install
npm run dev
```

Open http://localhost:5173

1. **Find path** — pick a target → see who to ask  
2. **Graph** — explore the network  
3. **Note** — open anyone; every link has a source  

## Deploy on Vercel

### Option A — Root Directory = `web` (recommended)

1. Import the GitHub repo in Vercel  
2. Set **Root Directory** to `web`  
3. Framework: Vite (auto)  
4. Build: `npm run build` · Output: `dist`  
5. Deploy  

`web/vercel.json` handles SPA rewrites and cache headers.

### Option B — Build from repo root

Leave Root Directory empty. Root `vercel.json` runs:

- Install: `npm --prefix web ci`  
- Build: `npm --prefix web ci && npm --prefix web run build`  
- Output: `web/dist`  

No env vars or secrets required.

### After deploy

- Turn off **Deployment Protection** if you want a public URL  
- Merge this branch to `main` for production  

Details: [PRODUCT.md](./PRODUCT.md)
