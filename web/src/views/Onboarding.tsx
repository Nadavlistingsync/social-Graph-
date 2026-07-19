import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ContactAuthPanel } from '../components/ContactAuthPanel'
import { useAuth } from '../context/AuthContext'
import { useGraph } from '../context/GraphContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { RateContacts } from './RateContacts'

type Step = 'auth' | 'intent' | 'profile' | 'contacts' | 'rate'
type AuthMode = 'signup' | 'signin'

/** Kept after finishOnboarding so App still shows remaining onboarding steps. */
export const CONTACTS_GATE_KEY = 'sg-pending-contacts'

export function isContactsGateOpen(): boolean {
  try {
    return sessionStorage.getItem(CONTACTS_GATE_KEY) === '1'
  } catch {
    return false
  }
}

function openContactsGate() {
  try {
    sessionStorage.setItem(CONTACTS_GATE_KEY, '1')
  } catch {
    /* ignore */
  }
}

function closeContactsGate() {
  try {
    sessionStorage.removeItem(CONTACTS_GATE_KEY)
  } catch {
    /* ignore */
  }
}

function gateStep(): Step {
  try {
    const s = sessionStorage.getItem('sg-onboarding-step')
    if (s === 'contacts' || s === 'rate' || s === 'profile' || s === 'intent') return s
  } catch {
    /* ignore */
  }
  return isContactsGateOpen() ? 'contacts' : 'auth'
}

function rememberStep(step: Step) {
  try {
    if (step === 'auth') sessionStorage.removeItem('sg-onboarding-step')
    else sessionStorage.setItem('sg-onboarding-step', step)
  } catch {
    /* ignore */
  }
}

export function Onboarding() {
  const navigate = useNavigate()
  const { user, ready, configured, signInWithPassword, signUpWithPassword } = useAuth()
  const { finishOnboarding, profile } = useGraph()

  const [step, setStepState] = useState<Step>(() => gateStep())
  const [authMode, setAuthMode] = useState<AuthMode>('signup')
  const [name, setName] = useState(profile.name || '')
  const [targetPerson, setTargetPerson] = useState(profile.targetPerson || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadSample, setLoadSample] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  function setStep(next: Step) {
    rememberStep(next)
    setStepState(next)
  }

  useDocumentTitle(
    step === 'auth'
      ? authMode === 'signup'
        ? 'Create account'
        : 'Log in'
      : step === 'intent'
        ? 'Who are you trying to meet?'
        : step === 'profile'
          ? 'Your map'
          : step === 'rate'
            ? 'Rate contacts'
            : 'Contacts',
  )

  useEffect(() => {
    if (!ready) return
    if (user && step === 'auth') {
      if (!name && user.email) {
        const local = user.email.split('@')[0] || ''
        setName(local.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
      }
      setStep('intent')
    }
  }, [ready, user, step, name])

  function leaveToApp() {
    closeContactsGate()
    rememberStep('auth')
    navigate('/')
  }

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
        setStep('intent')
        return
      }

      const result = await signInWithPassword(email, password)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setStep('intent')
    } finally {
      setBusy(false)
    }
  }

  function handleIntent(e: FormEvent) {
    e.preventDefault()
    setStep('profile')
  }

  function handleProfile(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    openContactsGate()
    finishOnboarding(trimmed, loadSample, targetPerson.trim() || undefined)
    setStep('contacts')
  }

  function afterImport() {
    setStep('rate')
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

  if (step === 'rate') {
    return (
      <div className="onboarding onboarding-rate">
        <RateContacts
          embedded
          onComplete={() => {
            closeContactsGate()
            rememberStep('auth')
          }}
        />
      </div>
    )
  }

  if (step === 'contacts') {
    return (
      <div className="onboarding">
        <div className="onboarding-card onboarding-wide" id="main">
          <div className="brand-mark">Social Graph</div>
          <h1>Upload your people</h1>
          <p className="lede">
            Google, Apple, LinkedIn, or paste a list. Then we’ll score how well you know each
            person.
          </p>
          <ContactAuthPanel
            showSkip
            onSkip={leaveToApp}
            onSuccess={() => afterImport()}
            compact
          />
          <p className="section-hint" style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            <Link to="/" onClick={closeContactsGate}>
              Skip to empty map →
            </Link>
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
            Start blank and import real contacts — sample is optional.
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
                  checked={!loadSample}
                  onChange={() => setLoadSample(false)}
                />
                <span>
                  <strong>Blank map</strong>
                  <span className="choice-desc">Just you — import contacts next.</span>
                </span>
              </label>
              <label className="choice-card">
                <input
                  type="radio"
                  name="start"
                  checked={loadSample}
                  onChange={() => setLoadSample(true)}
                />
                <span>
                  <strong>Sample network</strong>
                  <span className="choice-desc">Explore a demo map while you learn the product.</span>
                </span>
              </label>
            </fieldset>
            <button type="submit" className="btn-primary" disabled={!name.trim()}>
              Continue to contacts
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'intent') {
    return (
      <div className="onboarding">
        <div className="onboarding-card" id="main">
          <div className="brand-mark">Social Graph</div>
          <h1>See who can introduce you</h1>
          <p className="lede">
            Upload your network, rate relationships, then find warm paths to anyone — including
            people two or three hops away.
          </p>
          <form onSubmit={handleIntent}>
            <div className="field">
              <label className="field-label" htmlFor="target-person">
                Who are you trying to meet? <span className="optional">(optional)</span>
              </label>
              <input
                id="target-person"
                value={targetPerson}
                onChange={(e) => setTargetPerson(e.target.value)}
                placeholder="e.g. a founder, investor, or hiring manager"
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary">
              Continue
            </button>
            <button type="button" className="text-btn skip-auth" onClick={() => setStep('profile')}>
              Skip for now
            </button>
          </form>
        </div>
      </div>
    )
  }

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
          onClick={() => setStep('intent')}
        >
          Continue without account
        </button>
      </div>
    </div>
  )
}
