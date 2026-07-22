import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  DEMO_EXTENDED_EVENT,
  DEMO_STEPS,
  DEMO_STEP_EVENT,
  exitDemoMode,
  getDemoStep,
  isDemoMode,
  setDemoStep,
  startOwnContactsFromDemo,
  type DemoStep,
} from '../data/demoMode'

export function DemoGuide() {
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStepState] = useState<DemoStep>(() => getDemoStep())
  const [visible, setVisible] = useState(isDemoMode())
  const [extendedOn, setExtendedOn] = useState(false)

  useEffect(() => {
    const sync = () => {
      setVisible(isDemoMode())
      setStepState(getDemoStep())
    }
    window.addEventListener(DEMO_STEP_EVENT, sync)
    return () => window.removeEventListener(DEMO_STEP_EVENT, sync)
  }, [])

  if (!visible) return null

  const config = DEMO_STEPS[step]

  function advance(next: DemoStep) {
    setDemoStep(next)
    setStepState(next)
    const route = DEMO_STEPS[next]?.route
    if (route && route !== location.pathname + location.search) {
      navigate(route)
    }
  }

  function handlePrimary() {
    if (step === 3) {
      window.dispatchEvent(new Event(DEMO_EXTENDED_EVENT))
      setExtendedOn(true)
      window.setTimeout(() => advance(4), 450)
      return
    }
    if (step === 4) {
      navigate('/find?to=donald-trump')
      advance(5)
      return
    }
    if (step === 5) {
      startOwnContactsFromDemo()
      setVisible(false)
      navigate('/', { replace: true })
      return
    }
    advance((step + 1) as DemoStep)
  }

  function handleExit() {
    exitDemoMode()
    setVisible(false)
  }

  return (
    <>
      <div className="demo-banner demo-banner-fixed" role="status">
        <span>
          <strong>Live demo</strong> · illustrative public network · not your private data
        </span>
        <button type="button" className="chip" onClick={handleExit}>
          Exit demo
        </button>
      </div>

      <div className="demo-guide" role="dialog" aria-labelledby="demo-guide-title">
        <div className="demo-guide-progress" aria-hidden>
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={n <= step ? 'on' : ''} />
          ))}
        </div>
        <p className="demo-guide-step">Step {step} of 5</p>
        <h2 id="demo-guide-title">{config.title}</h2>
        <p className="demo-guide-body">{config.body}</p>
        {step === 3 && extendedOn && (
          <p className="demo-guide-hint">Their network is on — tap Next to find the intro.</p>
        )}
        <div className="demo-guide-actions">
          {step > 1 && step < 5 && (
            <button type="button" className="chip" onClick={() => advance((step - 1) as DemoStep)}>
              Back
            </button>
          )}
          <button type="button" className="btn-primary" onClick={handlePrimary}>
            {step === 3 && extendedOn ? 'Next' : config.cta || 'Next'}
          </button>
        </div>
      </div>
    </>
  )
}
