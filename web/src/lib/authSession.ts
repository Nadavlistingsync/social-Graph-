const SESSION_KEY = 'sg-auth-session-v1'

export type AuthUser = {
  id: string
  email?: string | null
}

export type AuthSession = {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: AuthUser
}

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed?.access_token || !parsed?.user?.id) return null
    return parsed
  } catch {
    return null
  }
}

export function saveSession(session: AuthSession | null): void {
  try {
    if (!session) localStorage.removeItem(SESSION_KEY)
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  saveSession(null)
}

/**
 * Supabase magic-link / confirm-email redirects land with tokens in the URL hash
 * (or occasionally query). Consume them once and clear the URL.
 */
export function consumeAuthRedirect(): {
  access_token: string
  refresh_token: string
  expires_at?: number
} | null {
  if (typeof window === 'undefined') return null
  try {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash
    const fromHash = new URLSearchParams(hash)
    const fromQuery = new URLSearchParams(window.location.search)
    const access_token =
      fromHash.get('access_token') || fromQuery.get('access_token') || ''
    const refresh_token =
      fromHash.get('refresh_token') || fromQuery.get('refresh_token') || ''
    if (!access_token || !refresh_token) return null

    const expiresInRaw = fromHash.get('expires_in') || fromQuery.get('expires_in')
    const expiresIn = expiresInRaw ? Number(expiresInRaw) : NaN
    const expires_at = Number.isFinite(expiresIn)
      ? Math.floor(Date.now() / 1000) + expiresIn
      : undefined

    const drop = new Set(['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'type'])
    const kept = [...fromQuery.entries()].filter(([k]) => !drop.has(k))
    const search = kept.length
      ? `?${kept.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
      : ''
    window.history.replaceState({}, '', `${window.location.pathname}${search}`)

    return { access_token, refresh_token, expires_at }
  } catch {
    return null
  }
}

export async function apiJson<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const { token, headers, ...rest } = init
  const res = await fetch(path, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { error: text }
  }
  if (!res.ok) {
    const err =
      data && typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`
    return { ok: false, error: err, status: res.status }
  }
  return { ok: true, data: data as T }
}
