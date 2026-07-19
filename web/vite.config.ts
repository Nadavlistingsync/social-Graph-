import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function loadEnvLocal() {
  const path = resolve(__dirname, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i < 0) continue
    const key = trimmed.slice(0, i)
    const value = trimmed.slice(i + 1)
    if (!process.env[key]) process.env[key] = value
  }
}

function graphApiPlugin(): Plugin {
  return {
    name: 'graph-api-dev',
    configureServer(server) {
      loadEnvLocal()
      // Mirror server-only secrets for local middleware
      if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
        process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL
      }
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/graph')) return next()
        try {
          const mod = await server.ssrLoadModule('/api/graph.js')
          const handler = mod.default
          await handler(req, res)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'dev api error' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), graphApiPlugin()],
})
