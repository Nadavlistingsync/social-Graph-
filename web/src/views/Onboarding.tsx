import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ContactAuthPanel } from '../components/ContactAuthPanel'
import { useAuth } from '../context/AuthContext'
import { useGraph } from '../context/GraphContext'
import { isOnboarded as readOnboarded } from '../data/graphStore'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  markAwaitingContactStep,
  markFirstRunPending,
} from '../lib/onboardingFlow'

type OnboardingProps = {
  /** Workspace already created; show only the contacts step. */
  contactsOnly?: boolean
  onWorkspaceCreated?: () => void
  onEnterApp?: () => void
}

type Mode = 'signup' | 'login'

export function Onboarding({
  contactsOnly = false,
  onWorkspaceCreated,
  onEnterApp,
}: OnboardingProps) {
  const navigate = useNavigate()
  const { signUp, logIn, hasAccounts, account } = useAuth()
  const { finishOnboarding, isOnboarded } = useGraph()
  const [step, setStep] = useState<1 | 2>(contactsOnly ? 2 : 1)
  const [mode, setMode] = useState<Mode>(hasAccounts ? 'login' : 'signup')

  const [name, setName] = useState(account?.name ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loadSample, setLoadSample] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)

  useDocumentTitle(
    step === 2 ? 'Connect contacts' : mode === 'login' ? 'Log in' : 'Create account',
  )

  function enterApp() {
    markFirstRunPending()
    onEnterApp?.()
    navigate('/', { replace: true })
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    const result = await signUp({ name, email, password })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    finishOnboarding(name.trim(), loadSample)
    markAwaitingContactStep()
    onWorkspaceCreated?.()
    setStep(2)
  }

  async function handleLogIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const result = await logIn({ email, password })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (readOnboarded()) {
      onEnterApp?.()
      navigate('/', { replace: true })
      return
    }
    setMode('signup')
    setPassword('')
    setError('')
  }

  if (step === 2) {
    return (
      <div className="onboarding">
        <div className="onboarding-card onboarding-wide" id="main">
          <div className="brand-mark">Social Graph</div>
          <p className="onboarding-step" aria-hidden>
            Almost there
          </p>
          <h1>Connect who you know</h1>
          <p className="lede">
            Optional — drop a contacts export or sign in. You can always do this later from the
            sidebar.
          </p>

          {importedCount !== null ? (
            <div className="import-result onboarding-done">
              <strong>
                {importedCount === 0
                  ? 'No new contacts added'
                  : `Imported ${importedCount} contact${importedCount === 1 ? '' : 's'}`}
              </strong>
              <p className="section-hint">You’re set. Open your graph and find a warm intro.</p>
              <button type="button" className="btn-primary" onClick={enterApp}>
                Start exploring
              </button>
            </div>
          ) : (
            <>
              <button type="button" className="btn-primary" onClick={enterApp}>
                Start exploring
              </button>
              <div className="auth-divider onboarding-divider">
                <span>or add contacts first</span>
              </div>
              <ContactAuthPanel
                onSuccess={(imported) => setImportedCount(imported)}
                compact
              />
            </>
          )}
        </div>
      </div>
    )
  }

  // Logged in but graph not created yet (edge case)
  if (account && !isOnboarded && mode !== 'login') {
    return (
      <div className="onboarding">
        <div className="onboarding-card" id="main">
          <div className="brand-mark">Social Graph</div>
          <h1>Set up your graph</h1>
          <p className="lede">Signed in as {account.email}. Choose how to start.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              finishOnboarding(account.name || name.trim() || 'You', loadSample)
              markAwaitingContactStep()
              onWorkspaceCreated?.()
              setStep(2)
            }}
          >
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
                  <span className="choice-desc">
                    Explore with a public NYC real-estate demo. Mark who you actually know.
                  </span>
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
                  <strong>Blank graph</strong>
                  <span className="choice-desc">
                    Just you. Add people and connections as you build your map.
                  </span>
                </span>
              </label>
            </fieldset>
            <button type="submit" className="btn-primary">
              Continue
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (mode === 'login') {
    return (
      <div className="onboarding">
        <div className="onboarding-card" id="main">
          <div className="brand-mark">Social Graph</div>
          <h1>Welcome back</h1>
          <p className="lede">Log in with your email and password to open your graph.</p>

          <form onSubmit={handleLogIn}>
            <div className="field">
              <label className="field-label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={busy || !email || !password}>
              {busy ? 'Signing in…' : 'Log in'}
            </button>
          </form>

          <p className="auth-switch">
            New here?{' '}
            <button
              type="button"
              className="text-btn inline"
              onClick={() => {
                setMode('signup')
                setError('')
                setPassword('')
              }}
            >
              Create an account
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card" id="main">
        <div className="brand-mark">Social Graph</div>
        <h1>Create your account</h1>
        <p className="lede">
          Sign up with email and password. Your graph is saved on this device under your account.
        </p>

        <form onSubmit={handleSignUp}>
          <div className="field">
            <label className="field-label" htmlFor="signup-name">
              Your name
            </label>
            <input
              id="signup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Chen"
              autoComplete="name"
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="signup-email">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="signup-password">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="signup-confirm">
              Confirm password
            </label>
            <input
              id="signup-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
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
                <span className="choice-desc">
                  Explore with a public NYC real-estate demo. Mark who you actually know.
                </span>
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
                <strong>Blank graph</strong>
                <span className="choice-desc">
                  Just you. Add people and connections as you build your map.
                </span>
              </span>
            </label>
          </fieldset>

          {error && <p className="form-error">{error}</p>}
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || !name.trim() || !email.trim() || password.length < 8}
          >
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        {hasAccounts && (
          <p className="auth-switch">
            Already have an account?{' '}
            <button
              type="button"
              className="text-btn inline"
              onClick={() => {
                setMode('login')
                setError('')
                setPassword('')
                setConfirm('')
              }}
            >
              Log in
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
