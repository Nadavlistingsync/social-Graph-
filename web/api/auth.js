import {
  anonKey,
  isSupabaseEnvConfigured,
  readJson,
  send,
  serviceKey,
  supabaseUrl,
} from './_lib.js'

async function supabaseAuth(path, init = {}) {
  const url = supabaseUrl()
  const key = anonKey() || serviceKey()
  const res = await fetch(`${url}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { message: text }
  }
  return { ok: res.ok, status: res.status, data }
}

function sessionPayload(data) {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    expires_at: data.expires_at,
    token_type: data.token_type,
    user: data.user,
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    return send(res, 204, '')
  }

  const url = new URL(req.url || '/', 'http://local')
  const action = (url.searchParams.get('action') || '').replace(/^\//, '')

  if (action === 'status' && req.method === 'GET') {
    return send(res, 200, { configured: isSupabaseEnvConfigured() })
  }

  if (!isSupabaseEnvConfigured()) {
    return send(res, 503, { error: 'Supabase is not configured on the server (.env)' })
  }

  try {
    if (action === 'signin' && req.method === 'POST') {
      const body = await readJson(req)
      const email = String(body.email || '').trim()
      const password = String(body.password || '')
      if (!email || !password) return send(res, 400, { error: 'Email and password required' })
      const { ok, data } = await supabaseAuth('/token?grant_type=password', {
        method: 'POST',
        headers: { Authorization: `Bearer ${anonKey() || serviceKey()}` },
        body: JSON.stringify({ email, password }),
      })
      if (!ok) return send(res, 400, { error: data?.error_description || data?.msg || data?.error || 'Sign in failed' })
      return send(res, 200, sessionPayload(data))
    }

    if (action === 'signup' && req.method === 'POST') {
      const body = await readJson(req)
      const email = String(body.email || '').trim()
      const password = String(body.password || '')
      const redirectTo = String(body.redirectTo || '').trim() || undefined
      if (!email || !password) return send(res, 400, { error: 'Email and password required' })
      const { ok, data } = await supabaseAuth('/signup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${anonKey() || serviceKey()}` },
        body: JSON.stringify({
          email,
          password,
          ...(redirectTo ? { email_redirect_to: redirectTo } : {}),
        }),
      })
      if (!ok) return send(res, 400, { error: data?.msg || data?.error_description || data?.error || 'Sign up failed' })
      if (data?.access_token) return send(res, 200, { ...sessionPayload(data), needsConfirm: false })
      return send(res, 200, { needsConfirm: true, user: data?.user ?? data })
    }

    if (action === 'magic' && req.method === 'POST') {
      const body = await readJson(req)
      const email = String(body.email || '').trim()
      const redirectTo = String(body.redirectTo || '').trim() || undefined
      if (!email) return send(res, 400, { error: 'Email required' })
      const { ok, data } = await supabaseAuth('/otp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${anonKey() || serviceKey()}` },
        body: JSON.stringify({
          email,
          ...(redirectTo ? { email_redirect_to: redirectTo } : {}),
        }),
      })
      if (!ok) return send(res, 400, { error: data?.msg || data?.error_description || data?.error || 'Could not send magic link' })
      return send(res, 200, { ok: true })
    }

    if (action === 'refresh' && req.method === 'POST') {
      const body = await readJson(req)
      const refresh_token = String(body.refresh_token || '')
      if (!refresh_token) return send(res, 400, { error: 'refresh_token required' })
      const { ok, data } = await supabaseAuth('/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${anonKey() || serviceKey()}` },
        body: JSON.stringify({ refresh_token }),
      })
      if (!ok) return send(res, 401, { error: data?.error_description || data?.msg || 'Session expired' })
      return send(res, 200, sessionPayload(data))
    }

    if (action === 'signout' && req.method === 'POST') {
      return send(res, 200, { ok: true })
    }

    return send(res, 404, { error: `Unknown auth action: ${action || '(none)'}` })
  } catch (err) {
    return send(res, 500, { error: err instanceof Error ? err.message : 'Auth error' })
  }
}
