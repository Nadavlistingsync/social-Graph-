import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ContactAuthPanel } from '../components/ContactAuthPanel'
import { useGraph } from '../context/GraphContext'
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

export function Onboarding({
  contactsOnly = false,
  onWorkspaceCreated,
  onEnterApp,
}: OnboardingProps) {
  const navigate = useNavigate()
  const { finishOnboarding } = useGraph()
  const [step, setStep] = useState<1 | 2>(contactsOnly ? 2 : 1)
  const [name, setName] = useState('')
  const [loadSample, setLoadSample] = useState(true)
  const [importedCount, setImportedCount] = useState<number | null>(null)

  useDocumentTitle(step === 1 ? 'Create your graph' : 'Connect contacts')

  function enterApp() {
    markFirstRunPending()
    onEnterApp?.()
    navigate('/', { replace: true })
  }

  function startGraph(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    finishOnboarding(trimmed, loadSample)
    markAwaitingContactStep()
    onWorkspaceCreated?.()
    setStep(2)
  }

  if (step === 2) {
    return (
      <div className="onboarding">
        <div className="onboarding-card onboarding-wide" id="main">
          <div className="brand-mark">Social Graph</div>
          <p className="onboarding-step" aria-hidden>
            2 / 2
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

  return (
    <div className="onboarding">
      <div className="onboarding-card" id="main">
        <div className="brand-mark">Social Graph</div>
        <p className="onboarding-step" aria-hidden>
          1 / 2
        </p>
        <h1>Create your graph</h1>
        <p className="lede">
          Who do you know who can get you to someone else? Your map stays in this browser — no
          account or password.
        </p>

        <form onSubmit={startGraph}>
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
              autoComplete="name"
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

          <button type="submit" className="btn-primary" disabled={!name.trim()}>
            Continue
          </button>
        </form>
      </div>
    </div>
  )
}
