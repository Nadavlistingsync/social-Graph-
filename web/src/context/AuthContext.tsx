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
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { pushLocalToRemote, reconcileOnSignIn, type SyncStatus } from '../data/remoteGraph'
import { onUserDataChanged } from '../data/syncBus'

type AuthContextValue = {
  configured: boolean
  ready: boolean
  session: Session | null
  user: User | null
  syncStatus: SyncStatus
  syncError: string | null
  signInWithPassword: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>
  signUpWithPassword: (email: string, password: string) => Promise<{ ok: true; needsConfirm: boolean } | { ok: false; error: string }>
  signInWithMagicLink: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>
  signOut: () => Promise<void>
  syncNow: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runReconcile = useCallback(async (userId: string) => {
    setSyncStatus('syncing')
    setSyncError(null)
    try {
      await reconcileOnSignIn(userId)
      setSyncStatus('synced')
      window.dispatchEvent(new Event('sg-data-reloaded'))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      setSyncError(message)
      setSyncStatus('error')
    }
  }, [])

  const schedulePush = useCallback(() => {
    const userId = userIdRef.current
    if (!userId || !isSupabaseConfigured) return
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(async () => {
      setSyncStatus('syncing')
      try {
        await pushLocalToRemote(userId)
        setSyncStatus('synced')
        setSyncError(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sync failed'
        setSyncError(message)
        setSyncStatus('error')
      }
    }, 600)
  }, [])

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) {
      setReady(true)
      return
    }

    let cancelled = false
    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      userIdRef.current = data.session?.user.id ?? null
      setReady(true)
      if (data.session?.user.id) void runReconcile(data.session.user.id)
    })

    const { data: sub } = sb.auth.onAuthStateChange((event, next) => {
      setSession(next)
      userIdRef.current = next?.user.id ?? null
      if (event === 'SIGNED_IN' && next?.user.id) {
        void runReconcile(next.user.id)
      }
      if (event === 'SIGNED_OUT') {
        setSyncStatus('idle')
        setSyncError(null)
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [runReconcile])

  useEffect(() => {
    return onUserDataChanged(() => {
      schedulePush()
    })
  }, [schedulePush])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const sb = getSupabase()
    if (!sb) return { ok: false as const, error: 'Supabase is not configured' }
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return { ok: false as const, error: error.message }
    return { ok: true as const }
  }, [])

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const sb = getSupabase()
    if (!sb) return { ok: false as const, error: 'Supabase is not configured' }
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) return { ok: false as const, error: error.message }
    return { ok: true as const, needsConfirm: !data.session }
  }, [])

  const signInWithMagicLink = useCallback(async (email: string) => {
    const sb = getSupabase()
    if (!sb) return { ok: false as const, error: 'Supabase is not configured' }
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) return { ok: false as const, error: error.message }
    return { ok: true as const }
  }, [])

  const signOut = useCallback(async () => {
    const sb = getSupabase()
    if (!sb) return
    await sb.auth.signOut()
  }, [])

  const syncNow = useCallback(async () => {
    const userId = userIdRef.current
    if (!userId) return
    setSyncStatus('syncing')
    try {
      await pushLocalToRemote(userId)
      setSyncStatus('synced')
      setSyncError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      setSyncError(message)
      setSyncStatus('error')
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
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
