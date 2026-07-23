import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  DEMO_EXTENDED_EVENT,
  DEMO_STEPS,
  DEMO_STEP_EVENT,
  DEMO_TARGET_ID,
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
  const [autoPlay, setAutoPlay] = useState(false)
  const stepRef = useRef(step)
  const extendedRef = useRef(extendedOn)
  const locationRef = useRef(location)

  stepRef.current = step
  extendedRef.current = extendedOn
  locationRef.current = location

  useEffect(() => {
    const sync = () => {
      setVisible(isDemoMode())
      setStepState(getDemoStep())
    }
    window.addEventListener(DEMO_STEP_EVENT, sync)
    return () => window.removeEventListener(DEMO_STEP_EVENT, sync)
  }, [])

  function advance(next: DemoStep) {
    setDemoStep(next)
    setStepState(next)
    const route = DEMO_STEPS[next]?.route
    const here = locationRef.current.pathname + locationRef.current.search
    if (route && route !== here) {
      navigate(route)
    }
  }

  function handlePrimary() {
    const current = stepRef.current
    const loc = locationRef.current
    const extended = extendedRef.current

    if (current === 3 && !extended) {
      window.dispatchEvent(new Event(DEMO_EXTENDED_EVENT))
      setExtendedOn(true)
      window.setTimeout(() => advance(4), 500)
      return
    }
    if (current === 3 && extended) {
      advance(4)
      return
    }
    if (current === 4) {
      if (loc.pathname !== '/find') {
        navigate(`/find?to=${DEMO_TARGET_ID}`)
        window.setTimeout(() => advance(5), 300)
        return
      }
      advance(5)
      return
    }
    if (current === 5) {
      setAutoPlay(false)
      startOwnContactsFromDemo()
      setVisible(false)
      navigate('/', { replace: true })
      return
    }
    advance((current + 1) as DemoStep)
  }

  useEffect(() => {
    if (!autoPlay || !visible || step >= 5) return
    const delay = step === 3 && !extendedOn ? 1800 : step === 4 ? 2800 : 2600
    const timer = window.setTimeout(() => handlePrimary(), delay)
    return () => window.clearTimeout(timer)
  }, [autoPlay, visible, step, extendedOn, location.pathname])

  if (!visible) return null

  const config = DEMO_STEPS[step]
  const onFindStep = step === 4 && location.pathname === '/find'

  function handleExit() {
    setAutoPlay(false)
    exitDemoMode()
    setVisible(false)
  }

  function primaryLabel() {
    if (step === 3 && !extendedOn) return config.cta || 'Show their network'
    if (step === 3 && extendedOn) return 'Next'
    if (step === 4 && !onFindStep) return config.cta || 'See intro path'
    if (step === 4 && onFindStep) return 'Next'
    return config.cta || 'Next'
  }

  return (
    <>
      <div className="demo-banner demo-banner-fixed" role="status">
        <span>
          <strong>Live demo</strong> · warm intro to anyone · illustrative public network
        </span>
        <div className="demo-banner-actions">
          <button
            type="button"
            className={`chip ${autoPlay ? 'on' : ''}`}
            onClick={() => setAutoPlay((v) => !v)}
          >
            {autoPlay ? 'Pause' : 'Auto-play'}
          </button>
          <button type="button" className="chip" onClick={handleExit}>
            Exit
          </button>
        </div>
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
          <p className="demo-guide-hint">Their network unlocked — the path to Donald Trump lights up on the map.</p>
        )}
        {onFindStep && (
          <p className="demo-guide-hint demo-guide-payoff">Payoff: one person to ask, full path behind them.</p>
        )}
        <div className="demo-guide-actions">
          {step > 1 && step < 5 && (
            <button
              type="button"
              className="chip"
              onClick={() => {
                setAutoPlay(false)
                advance((step - 1) as DemoStep)
              }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            className="btn-primary demo-guide-cta"
            onClick={() => {
              setAutoPlay(false)
              handlePrimary()
            }}
          >
            {primaryLabel()}
          </button>
        </div>
      </div>
    </>
  )
}
