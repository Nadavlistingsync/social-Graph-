import {
  anonKey,
  isSupabaseEnvConfigured,
  readJson,
  send,
  serviceKey,
  supabaseUrl,
} from './_lib.js'

async function supabaseAuth(path, init = {}, useServiceRole = false) {
  const url = supabaseUrl()
  const key = useServiceRole ? serviceKey() || anonKey() : anonKey() || serviceKey()
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

async function passwordSession(email, password) {
  return supabaseAuth('/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
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
    return send(res, 200, {
      configured: isSupabaseEnvConfigured(),
      canAutoConfirm: Boolean(serviceKey()),
    })
  }

  if (!isSupabaseEnvConfigured()) {
    return send(res, 503, { error: 'Supabase is not configured on the server (.env)' })
  }

  try {
    if (action === 'signin' && req.method === 'POST') {
      const body = await readJson(req)
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      if (!email || !password) return send(res, 400, { error: 'Email and password required' })
      const { ok, data } = await passwordSession(email, password)
      if (!ok) {
        return send(res, 400, {
          error: data?.error_description || data?.msg || data?.error || 'Wrong email or password',
        })
      }
      return send(res, 200, sessionPayload(data))
    }

    if (action === 'signup' && req.method === 'POST') {
      const body = await readJson(req)
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const name = String(body.name || '').trim()
      if (!email || !password) return send(res, 400, { error: 'Email and password required' })
      if (password.length < 6) return send(res, 400, { error: 'Password must be at least 6 characters' })

      // Prefer admin create with email already confirmed so signup works without inbox.
      if (serviceKey()) {
        const created = await supabaseAuth(
          '/admin/users',
          {
            method: 'POST',
            body: JSON.stringify({
              email,
              password,
              email_confirm: true,
              user_metadata: name ? { name, full_name: name } : {},
            }),
          },
          true,
        )
        if (!created.ok) {
          const msg = created.data?.msg || created.data?.error_description || created.data?.error || ''
          if (/already|registered|exists/i.test(String(msg))) {
            return send(res, 400, { error: 'That email already has an account. Log in instead.' })
          }
          return send(res, 400, { error: msg || 'Could not create account' })
        }
        const session = await passwordSession(email, password)
        if (!session.ok || !session.data?.access_token) {
          return send(res, 400, {
            error: session.data?.msg || 'Account created but sign-in failed. Try logging in.',
          })
        }
        return send(res, 200, { ...sessionPayload(session.data), needsConfirm: false })
      }

      // Fallback without service role: public signup (may require email confirm).
      const { ok, data } = await supabaseAuth('/signup', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          data: name ? { name, full_name: name } : {},
          email_redirect_to: String(body.redirectTo || '').trim() || undefined,
        }),
      })
      if (!ok) {
        return send(res, 400, {
          error: data?.msg || data?.error_description || data?.error || 'Sign up failed',
        })
      }
      if (data?.access_token) return send(res, 200, { ...sessionPayload(data), needsConfirm: false })
      return send(res, 200, { needsConfirm: true, user: data?.user ?? data })
    }

    if (action === 'magic' && req.method === 'POST') {
      const body = await readJson(req)
      const email = String(body.email || '').trim().toLowerCase()
      const redirectTo = String(body.redirectTo || '').trim() || undefined
      if (!email) return send(res, 400, { error: 'Email required' })
      const { ok, data } = await supabaseAuth('/otp', {
        method: 'POST',
        body: JSON.stringify({
          email,
          ...(redirectTo ? { email_redirect_to: redirectTo } : {}),
        }),
      })
      if (!ok) {
        return send(res, 400, {
          error: data?.msg || data?.error_description || data?.error || 'Could not send magic link',
        })
      }
      return send(res, 200, { ok: true })
    }

    if (action === 'refresh' && req.method === 'POST') {
      const body = await readJson(req)
      const refresh_token = String(body.refresh_token || '')
      if (!refresh_token) return send(res, 400, { error: 'refresh_token required' })
      const { ok, data } = await supabaseAuth('/token?grant_type=refresh_token', {
        method: 'POST',
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
