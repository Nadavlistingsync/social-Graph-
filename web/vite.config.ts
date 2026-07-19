import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function loadEnvFile(path: string) {
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

function loadServerEnv() {
  // Prefer server .env — never bake secrets into the Vite client bundle
  loadEnvFile(resolve(__dirname, '../../.env'))
  loadEnvFile(resolve(__dirname, '../.env'))
  loadEnvFile(resolve(__dirname, '.env'))
  loadEnvFile(resolve(__dirname, '.env.local'))
}

function apiPlugin(): Plugin {
  return {
    name: 'server-api-dev',
    configureServer(server) {
      loadServerEnv()
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] || ''
        let modulePath: string | null = null
        if (path === '/api/graph') modulePath = '/api/graph.js'
        else if (path === '/api/auth') modulePath = '/api/auth.js'
        else if (path === '/api/ai') modulePath = '/api/ai.js'
        if (!modulePath) return next()
        try {
          const mod = await server.ssrLoadModule(modulePath)
          await mod.default(req, res)
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
  plugins: [react(), apiPlugin()],
  // Do not expose SUPABASE_* to import.meta.env
  envPrefix: ['VITE_'],
})
