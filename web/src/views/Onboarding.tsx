import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ContactAuthPanel } from '../components/ContactAuthPanel'
import { useGraph } from '../context/GraphContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function Onboarding() {
  const navigate = useNavigate()
  const { finishOnboarding } = useGraph()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [loadSample, setLoadSample] = useState(true)

  useDocumentTitle(step === 1 ? 'Welcome' : 'Import contacts')

  function startGraph(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    finishOnboarding(trimmed, loadSample)
    setStep(2)
  }

  if (step === 2) {
    return (
      <div className="onboarding">
        <div className="onboarding-card onboarding-wide" id="main">
          <div className="brand-mark">Social Graph</div>
          <h1>Add people you know</h1>
          <p className="lede">Import contacts, or skip and add them on the map.</p>
          <ContactAuthPanel showSkip onSkip={() => navigate('/')} compact />
          <p className="section-hint" style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            <Link to="/">See my network →</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card" id="main">
        <div className="brand-mark">Social Graph</div>
        <h1>See your network</h1>
        <p className="lede">
          Start with people you know. Then explore who they know. Finding intros comes after.
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
            Open my network
          </button>
        </form>
      </div>
    </div>
  )
}
