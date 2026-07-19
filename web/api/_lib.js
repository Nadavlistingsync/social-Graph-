/** Shared env helpers for /api/* (server-only — never import from the Vite app). */

export function env(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    const v = process.env[key]
    if (v) return v
  }
  return ''
}

export function supabaseUrl() {
  // Accept names from our .env and from the Vercel ↔ Supabase integration
  return env(
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'VITE_SUPABASE_URL',
  ).replace(/\/$/, '')
}

export function anonKey() {
  return env(
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_ANON_KEY',
  )
}

export function serviceKey() {
  return env(
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_KEY',
  )
}

export function isSupabaseEnvConfigured() {
  return Boolean(supabaseUrl() && (anonKey() || serviceKey()))
}

export function openRouterKey() {
  return env('OPENROUTER_API_KEY')
}

/** Prefer free OpenRouter models so scoring works with a $0 key. */
export function openRouterModel() {
  return env('OPENROUTER_MODEL') || 'google/gemma-4-26b-a4b-it:free'
}

/** Fallback chain when the primary free model is rate-limited. */
export function openRouterModelFallbacks() {
  const primary = openRouterModel()
  const extras = (env('OPENROUTER_MODEL_FALLBACKS') ||
    'openrouter/free,nvidia/nemotron-nano-9b-v2:free,meta-llama/llama-3.2-3b-instruct:free')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return [primary, ...extras.filter((m) => m !== primary)]
}

export function isOpenRouterConfigured() {
  return Boolean(openRouterKey())
}

export function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

export async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

export async function readJson(req) {
  const raw = await readBody(req)
  if (!raw) return {}
  return JSON.parse(raw)
}

export async function verifyUser(accessToken) {
  const url = supabaseUrl()
  const key = anonKey() || serviceKey()
  if (!url || !key || !accessToken) return null
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!res.ok) return null
  const user = await res.json()
  return user?.id ? user : null
}

export function bearer(req) {
  const auth = req.headers.authorization || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : ''
}
