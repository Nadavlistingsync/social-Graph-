import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ContactAuthPanel } from '../components/ContactAuthPanel'
import { useAuth } from '../context/AuthContext'
import { useGraph } from '../context/GraphContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

type Step = 'auth' | 'profile' | 'contacts'
type AuthMode = 'signup' | 'signin'

export function Onboarding() {
  const navigate = useNavigate()
  const { user, ready, configured, signInWithPassword, signUpWithPassword } = useAuth()
  const { finishOnboarding, profile } = useGraph()

  const [step, setStep] = useState<Step>('auth')
  const [authMode, setAuthMode] = useState<AuthMode>('signup')
  const [name, setName] = useState(profile.name || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadSample, setLoadSample] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useDocumentTitle(
    step === 'auth' ? (authMode === 'signup' ? 'Create account' : 'Log in') : step === 'profile' ? 'Your map' : 'Contacts',
  )

  // Returning signed-in user who hasn't finished profile yet
  useEffect(() => {
    if (!ready) return
    if (user && step === 'auth') {
      if (!name && user.email) {
        const local = user.email.split('@')[0] || ''
        setName(local.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
      }
      setStep('profile')
    }
  }, [ready, user, step, name])

  async function handleAuth(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (authMode === 'signup') {
        if (!name.trim()) {
          setError('Add your name.')
          return
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.')
          return
        }
        const result = await signUpWithPassword(email, password, name.trim())
        if (!result.ok) {
          setError(result.error)
          return
        }
        if (result.needsConfirm) {
          setInfo('Check your email to confirm, then log in.')
          setAuthMode('signin')
          return
        }
        setStep('profile')
        return
      }

      const result = await signInWithPassword(email, password)
      if (!result.ok) {
        setError(result.error)
        return
      }
      // Profile step if needed; App will skip onboarding once remote/local is onboarded
      setStep('profile')
    } finally {
      setBusy(false)
    }
  }

  function handleProfile(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    finishOnboarding(trimmed, loadSample)
    setStep('contacts')
  }

  if (!ready) {
    return (
      <div className="onboarding">
        <div className="onboarding-card" id="main">
          <div className="brand-mark">Social Graph</div>
          <p className="lede">Loading…</p>
        </div>
      </div>
    )
  }

  if (step === 'contacts') {
    return (
      <div className="onboarding">
        <div className="onboarding-card onboarding-wide" id="main">
          <div className="brand-mark">Social Graph</div>
          <h1>Add people you know</h1>
          <p className="lede">
            Google, Apple Contacts, or LinkedIn Connections.csv — or skip and build the map yourself.
          </p>
          <ContactAuthPanel showSkip onSkip={() => navigate('/')} compact />
          <p className="section-hint" style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            <Link to="/">See my network →</Link>
          </p>
        </div>
      </div>
    )
  }

  if (step === 'profile') {
    return (
      <div className="onboarding">
        <div className="onboarding-card" id="main">
          <div className="brand-mark">Social Graph</div>
          <h1>Set up your map</h1>
          <p className="lede">
            {user ? `Signed in as ${user.email}. ` : ''}
            Choose how you want to start.
          </p>
          <form onSubmit={handleProfile}>
            <div className="field">
              <label className="field-label" htmlFor="your-name">
                Your name
              </label>
              <input
                id="your-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Chen"
                autoFocus
                required
              />
            </div>
            <fieldset className="onboarding-choice">
              <legend className="field-label">Start with</legend>
              <label className="choice-card">
                <input
                  type="radio"
                  name="start"
                  checked={loadSample}
                  onChange={() => setLoadSample(true)}
                />
                <span>
                  <strong>Sample network</strong>
                  <span className="choice-desc">Explore a demo map, then mark who you know.</span>
                </span>
              </label>
              <label className="choice-card">
                <input
                  type="radio"
                  name="start"
                  checked={!loadSample}
                  onChange={() => setLoadSample(false)}
                />
                <span>
                  <strong>Blank map</strong>
                  <span className="choice-desc">Just you — add people as you go.</span>
                </span>
              </label>
            </fieldset>
            <button type="submit" className="btn-primary" disabled={!name.trim()}>
              Continue
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Auth step
  return (
    <div className="onboarding">
      <div className="onboarding-card" id="main">
        <div className="brand-mark">Social Graph</div>
        <h1>{authMode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
        <p className="lede">
          {authMode === 'signup'
            ? 'Save your network across devices, then map who you know.'
            : 'Log in to open your synced network.'}
        </p>

        {!configured && (
          <p className="form-error">
            Sign-in isn’t configured on this deploy yet. You can still continue locally below.
          </p>
        )}

        <div className="account-modes" role="tablist" aria-label="Account mode">
          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'signup'}
            className={`chip ${authMode === 'signup' ? 'on' : ''}`}
            onClick={() => {
              setAuthMode('signup')
              setError('')
              setInfo('')
            }}
          >
            Sign up
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'signin'}
            className={`chip ${authMode === 'signin' ? 'on' : ''}`}
            onClick={() => {
              setAuthMode('signin')
              setError('')
              setInfo('')
            }}
          >
            Log in
          </button>
        </div>

        <form onSubmit={handleAuth} className="account-form" style={{ marginTop: '1rem' }}>
          {authMode === 'signup' && (
            <div className="field">
              <label className="field-label" htmlFor="auth-name">
                Your name
              </label>
              <input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Chen"
                autoFocus
                required
              />
            </div>
          )}
          <div className="field">
            <label className="field-label" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus={authMode === 'signin'}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || !configured || !email.trim() || !password}
          >
            {busy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>

        {error && <p className="form-error">{error}</p>}
        {info && <p className="auth-hint">{info}</p>}

        <button
          type="button"
          className="text-btn skip-auth"
          style={{ marginTop: '1rem' }}
          onClick={() => setStep('profile')}
        >
          Continue without account
        </button>
      </div>
    </div>
  )
}
