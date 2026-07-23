type PitchScreenProps = {
  onStartDemo: () => void
  onSignIn: () => void
  onContinue: () => void
}

export function PitchScreen({ onStartDemo, onSignIn, onContinue }: PitchScreenProps) {
  return (
    <div className="onboarding pitch-screen">
      <div className="onboarding-card pitch-card" id="main">
        <div className="brand-mark">Social Graph</div>
        <p className="pitch-eyebrow">Warm-intro map · not a CRM</p>
        <h1>Who do you know who can get you to anyone?</h1>
        <p className="lede pitch-lede">
          Upload your people, see their network, find the best person to ask for an intro — with
          sources on every link.
        </p>

        <ul className="pitch-points">
          <li>
            <strong>Your network</strong>
            <span>Import contacts in seconds</span>
          </li>
          <li>
            <strong>Their network</strong>
            <span>Second-degree paths from public + contact data</span>
          </li>
          <li>
            <strong>Who to ask</strong>
            <span>Ranked warm intro paths, not cold outreach</span>
          </li>
        </ul>

        <div className="pitch-example">
          <span className="pitch-example-label">Example at scale</span>
          <span className="pitch-path-chain">You → 50,000 people → Donald Trump (or anyone)</span>
          <span className="pitch-example-note">Synthetic 50k-person demo · search any name · path in seconds</span>
        </div>

        <button type="button" className="btn-primary pitch-cta" onClick={onStartDemo}>
          Start live demo
        </button>
        <p className="pitch-autoplay-hint">60-second walkthrough · or tap Auto-play inside</p>
        <p className="pitch-secondary">
          <button type="button" className="text-btn" onClick={onContinue}>
            Continue with my contacts
          </button>
          <span className="pitch-dot">·</span>
          <button type="button" className="text-btn" onClick={onSignIn}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
