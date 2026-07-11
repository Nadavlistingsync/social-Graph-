# Social Graph

Warm-intro map. One question: **who do I know who can get me to this person?**

## Live

- Production: https://social-graph.vercel.app  
- Project: https://vercel.com/xeinst/social-graph  

If the URL asks you to log in to Vercel, turn off **Deployment Protection** in project Settings → Deployment Protection (disable Vercel Authentication).

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

Already connected to GitHub — pushes to `main` deploy to production automatically.

- Preferred: Vercel **Root Directory** = `web`  
- Or use root `vercel.json` (builds `web/` → `web/dist`)  
- No env vars required  

Details: [PRODUCT.md](./PRODUCT.md)
