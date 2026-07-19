import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

type Mode = 'signin' | 'signup' | 'magic'

export function AccountPanel({ compact = false }: { compact?: boolean }) {
  const {
    configured,
    user,
    syncStatus,
    syncError,
    signInWithPassword,
    signUpWithPassword,
    signInWithMagicLink,
    signOut,
    syncNow,
  } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!configured) {
    return (
      <p className="section-hint">
        Cloud sync is not configured. Set <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_ANON_KEY</code> on Vercel (or in <code>.env.local</code>).
      </p>
    )
  }

  if (user) {
    return (
      <div className="account-panel">
        <p className="section-hint" style={{ marginTop: 0 }}>
          Signed in as <strong>{user.email}</strong>
          {syncStatus === 'synced' && ' · synced'}
          {syncStatus === 'syncing' && ' · syncing…'}
          {syncStatus === 'error' && ' · sync error'}
        </p>
        {syncError && <p className="auth-hint error">{syncError}</p>}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="chip on" onClick={() => void syncNow()} disabled={busy}>
            Sync now
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => {
              void signOut()
            }}
          >
            Sign out
          </button>
        </div>
        {!compact && (
          <p className="section-hint">
            Your graph syncs to Supabase while signed in. This browser still keeps a local copy.
          </p>
        )}
      </div>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    setBusy(true)
    try {
      if (mode === 'magic') {
        const result = await signInWithMagicLink(email)
        if (!result.ok) setMessage(result.error)
        else setMessage('Check your email for the magic link.')
        return
      }
      if (mode === 'signup') {
        if (password.length < 6) {
          setMessage('Password must be at least 6 characters.')
          return
        }
        const result = await signUpWithPassword(email, password)
        if (!result.ok) setMessage(result.error)
        else if (result.needsConfirm) setMessage('Check your email to confirm your account.')
        else setMessage('Account created — you’re signed in.')
        return
      }
      const result = await signInWithPassword(email, password)
      if (!result.ok) setMessage(result.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="account-panel">
      <div className="account-modes" role="tablist" aria-label="Account mode">
        {(
          [
            ['signin', 'Sign in'],
            ['signup', 'Create account'],
            ['magic', 'Magic link'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            className={`chip ${mode === id ? 'on' : ''}`}
            onClick={() => {
              setMode(id)
              setMessage(null)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="account-form">
        <div className="field">
          <label className="field-label" htmlFor="account-email">
            Email
          </label>
          <input
            id="account-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@company.com"
          />
        </div>
        {mode !== 'magic' && (
          <div className="field">
            <label className="field-label" htmlFor="account-password">
              Password
            </label>
            <input
              id="account-password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={busy || !email.trim()}>
          {busy
            ? 'Please wait…'
            : mode === 'magic'
              ? 'Send magic link'
              : mode === 'signup'
                ? 'Create account'
                : 'Sign in'}
        </button>
      </form>
      {message && <p className="auth-hint">{message}</p>}
    </div>
  )
}
