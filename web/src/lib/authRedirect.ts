import type { AuthSession, AuthUser } from './authSession'

/**
 * Parse Supabase magic-link / OAuth redirect tokens from the URL hash or query.
 * Clears tokens from the address bar when found.
 */
export function consumeAuthRedirect(): AuthSession | null {
  if (typeof window === 'undefined') return null

  const hash = window.location.hash?.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash || ''
  const query = window.location.search?.startsWith('?')
    ? window.location.search.slice(1)
    : window.location.search || ''

  const fromHash = new URLSearchParams(hash)
  const fromQuery = new URLSearchParams(query)

  const access_token = fromHash.get('access_token') || fromQuery.get('access_token')
  const refresh_token = fromHash.get('refresh_token') || fromQuery.get('refresh_token')
  const expires_in = fromHash.get('expires_in') || fromQuery.get('expires_in')
  const expires_at_raw = fromHash.get('expires_at') || fromQuery.get('expires_at')
  const error = fromHash.get('error') || fromQuery.get('error_description') || fromQuery.get('error')

  if (error && !access_token) {
    clearAuthParamsFromUrl()
    return null
  }

  if (!access_token || !refresh_token) return null

  let expires_at: number | undefined
  if (expires_at_raw && /^\d+$/.test(expires_at_raw)) {
    expires_at = Number(expires_at_raw)
  } else if (expires_in && /^\d+$/.test(expires_in)) {
    expires_at = Math.floor(Date.now() / 1000) + Number(expires_in)
  }

  const user = userFromJwt(access_token)
  clearAuthParamsFromUrl()
  if (!user?.id) return null

  return {
    access_token,
    refresh_token,
    expires_at,
    user,
  }
}

function clearAuthParamsFromUrl() {
  try {
    const url = new URL(window.location.href)
    url.hash = ''
    for (const key of [
      'access_token',
      'refresh_token',
      'expires_in',
      'expires_at',
      'token_type',
      'type',
      'provider_token',
      'provider_refresh_token',
      'error',
      'error_code',
      'error_description',
    ]) {
      url.searchParams.delete(key)
    }
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}`)
  } catch {
    /* ignore */
  }
}

function userFromJwt(accessToken: string): AuthUser | null {
  try {
    const parts = accessToken.split('.')
    if (parts.length < 2) return null
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as { sub?: string; email?: string }
    if (!payload.sub) return null
    return { id: payload.sub, email: payload.email ?? null }
  } catch {
    return null
  }
}
