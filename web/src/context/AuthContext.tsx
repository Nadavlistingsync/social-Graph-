import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { pushLocalToRemote, reconcileOnSignIn, type SyncStatus } from '../data/remoteGraph'
import { onUserDataChanged } from '../data/syncBus'
import {
  apiJson,
  clearSession,
  loadSession,
  saveSession,
  type AuthSession,
  type AuthUser,
} from '../lib/authSession'
import { consumeAuthRedirect } from '../lib/authRedirect'

type AuthContextValue = {
  configured: boolean
  ready: boolean
  session: AuthSession | null
  user: AuthUser | null
  syncStatus: SyncStatus
  syncError: string | null
  signInWithPassword: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>
  signUpWithPassword: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<{ ok: true; needsConfirm: boolean } | { ok: false; error: string }>
  signInWithMagicLink: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>
  signOut: () => Promise<void>
  syncNow: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function asSession(data: Partial<AuthSession> & { access_token?: string; user?: AuthUser }): AuthSession | null {
  if (!data.access_token || !data.refresh_token || !data.user?.id) return null
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    user: { id: data.user.id, email: data.user.email },
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [configured, setConfigured] = useState(false)
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applySession = useCallback((next: AuthSession | null, reconcile: boolean) => {
    setSession(next)
    saveSession(next)
    userIdRef.current = next?.user.id ?? null
    if (next?.user.id && reconcile) {
      void (async () => {
        setSyncStatus('syncing')
        setSyncError(null)
        try {
          await reconcileOnSignIn(next.user.id)
          setSyncStatus('synced')
          window.dispatchEvent(new Event('sg-data-reloaded'))
        } catch (err) {
          setSyncError(err instanceof Error ? err.message : 'Sync failed')
          setSyncStatus('error')
        }
      })()
    }
    if (!next) {
      setSyncStatus('idle')
      setSyncError(null)
    }
  }, [])

  const refreshIfNeeded = useCallback(async (current: AuthSession): Promise<AuthSession | null> => {
    const expiresAt = current.expires_at
    const soon = expiresAt && expiresAt * 1000 < Date.now() + 60_000
    if (!soon && expiresAt) return current
    const result = await apiJson<AuthSession>('/api/auth?action=refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    })
    if (!result.ok) {
      clearSession()
      return null
    }
    const next = asSession(result.data)
    if (next) saveSession(next)
    return next
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const status = await apiJson<{ configured: boolean }>('/api/auth?action=status')
      if (cancelled) return
      const isConfigured = status.ok && status.data.configured
      setConfigured(isConfigured)

      // Magic link / email confirm redirects land with tokens in the hash.
      const fromRedirect = consumeAuthRedirect()
      if (fromRedirect) {
        saveSession(fromRedirect)
      }

      let current = fromRedirect ?? loadSession()
      if (current && isConfigured) {
        current = (await refreshIfNeeded(current)) ?? null
      }
      if (cancelled) return
      if (current) {
        setSession(current)
        userIdRef.current = current.user.id
        setReady(true)
        setSyncStatus('syncing')
        try {
          await reconcileOnSignIn(current.user.id)
          if (!cancelled) {
            setSyncStatus('synced')
            window.dispatchEvent(new Event('sg-data-reloaded'))
          }
        } catch (err) {
          if (!cancelled) {
            setSyncError(err instanceof Error ? err.message : 'Sync failed')
            setSyncStatus('error')
          }
        }
      } else {
        setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshIfNeeded])

  const schedulePush = useCallback(() => {
    const userId = userIdRef.current
    if (!userId || !configured) return
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(async () => {
      setSyncStatus('syncing')
      try {
        await pushLocalToRemote(userId)
        setSyncStatus('synced')
        setSyncError(null)
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : 'Sync failed')
        setSyncStatus('error')
      }
    }, 600)
  }, [configured])

  useEffect(() => onUserDataChanged(() => schedulePush()), [schedulePush])

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const result = await apiJson<AuthSession>('/api/auth?action=signin', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      })
      if (!result.ok) return { ok: false as const, error: result.error }
      const next = asSession(result.data)
      if (!next) return { ok: false as const, error: 'Invalid session response' }
      applySession(next, true)
      return { ok: true as const }
    },
    [applySession],
  )

  const signUpWithPassword = useCallback(
    async (email: string, password: string, name?: string) => {
      const result = await apiJson<AuthSession & { needsConfirm?: boolean }>('/api/auth?action=signup', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name?.trim() || undefined,
          redirectTo: window.location.origin,
        }),
      })
      if (!result.ok) return { ok: false as const, error: result.error }
      if (result.data.needsConfirm || !result.data.access_token) {
        return { ok: true as const, needsConfirm: true }
      }
      const next = asSession(result.data)
      if (!next) return { ok: true as const, needsConfirm: true }
      applySession(next, true)
      return { ok: true as const, needsConfirm: false }
    },
    [applySession],
  )

  const signInWithMagicLink = useCallback(async (email: string) => {
    const result = await apiJson<{ ok: true }>('/api/auth?action=magic', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), redirectTo: window.location.origin }),
    })
    if (!result.ok) return { ok: false as const, error: result.error }
    return { ok: true as const }
  }, [])

  const signOut = useCallback(async () => {
    const token = userIdRef.current ? loadSession()?.access_token : null
    // Best-effort push before clearing the session so cloud stays current.
    if (userIdRef.current && configured) {
      try {
        await pushLocalToRemote(userIdRef.current)
      } catch {
        /* keep signing out even if sync fails */
      }
    }
    await apiJson('/api/auth?action=signout', {
      method: 'POST',
      ...(token ? { token } : {}),
    })
    applySession(null, false)
  }, [applySession, configured])

  const syncNow = useCallback(async () => {
    const userId = userIdRef.current
    if (!userId) return
    setSyncStatus('syncing')
    try {
      await pushLocalToRemote(userId)
      setSyncStatus('synced')
      setSyncError(null)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
      setSyncStatus('error')
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      ready,
      session,
      user: session?.user ?? null,
      syncStatus,
      syncError,
      signInWithPassword,
      signUpWithPassword,
      signInWithMagicLink,
      signOut,
      syncNow,
    }),
    [
      configured,
      ready,
      session,
      syncStatus,
      syncError,
      signInWithPassword,
      signUpWithPassword,
      signInWithMagicLink,
      signOut,
      syncNow,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
