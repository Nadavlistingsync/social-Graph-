import { useState } from 'react'
import { useGraph } from '../context/GraphContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function Onboarding() {
  const { finishOnboarding } = useGraph()
  const [name, setName] = useState('')
  const [loadSample, setLoadSample] = useState(true)

  useDocumentTitle('Welcome')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    finishOnboarding(trimmed, loadSample)
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card" id="main">
        <div className="brand-mark">Social Graph</div>
        <h1>Map your warm intros</h1>
        <p className="lede">
          One question: who do you know who can get you to someone else? Your graph stays in this
          browser — no account required.
        </p>

        <form onSubmit={submit}>
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
                <span className="choice-desc">
                  Explore with a public NYC real-estate demo graph. Mark who you actually know.
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
            Start your graph
          </button>
        </form>
      </div>
    </div>
  )
}
