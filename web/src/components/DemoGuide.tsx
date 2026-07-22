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

const AUTO_ADVANCE_MS: Record<DemoStep, number> = {
  1: 3200,
  2: 3500,
  3: 4200,
  4: 6500,
  5: 0,
}

export function DemoGuide() {
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStepState] = useState<DemoStep>(() => getDemoStep())
  const [visible, setVisible] = useState(isDemoMode())
  const [extendedOn, setExtendedOn] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const autoTimer = useRef<number | null>(null)

  useEffect(() => {
    const sync = () => {
      setVisible(isDemoMode())
      setStepState(getDemoStep())
    }
    window.addEventListener(DEMO_STEP_EVENT, sync)
    return () => window.removeEventListener(DEMO_STEP_EVENT, sync)
  }, [])

  useEffect(() => {
    if (autoTimer.current) {
      window.clearTimeout(autoTimer.current)
      autoTimer.current = null
    }
    if (!autoPlay || !visible || step >= 5) return

    const delay = step === 4 && location.pathname !== '/find' ? 1200 : AUTO_ADVANCE_MS[step]
    autoTimer.current = window.setTimeout(() => {
      handlePrimary(true)
    }, delay)

    return () => {
      if (autoTimer.current) window.clearTimeout(autoTimer.current)
    }
  }, [autoPlay, visible, step, location.pathname, extendedOn])

  if (!visible) return null

  const config = DEMO_STEPS[step]
  const onFindStep = step === 4 && location.pathname === '/find'

  function advance(next: DemoStep) {
    setDemoStep(next)
    setStepState(next)
    const route = DEMO_STEPS[next]?.route
    if (route && route !== location.pathname + location.search) {
      navigate(route)
    }
  }

  function handlePrimary(fromAuto = false) {
    if (step === 3 && !extendedOn) {
      window.dispatchEvent(new Event(DEMO_EXTENDED_EVENT))
      setExtendedOn(true)
      if (!fromAuto) {
        window.setTimeout(() => advance(4), 500)
      }
      return
    }
    if (step === 3 && extendedOn) {
      advance(4)
      return
    }
    if (step === 4) {
      if (location.pathname !== '/find') {
        navigate(`/find?to=${DEMO_TARGET_ID}`)
        return
      }
      advance(5)
      return
    }
    if (step === 5) {
      setAutoPlay(false)
      startOwnContactsFromDemo()
      setVisible(false)
      navigate('/', { replace: true })
      return
    }
    advance((step + 1) as DemoStep)
  }

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
              handlePrimary(false)
            }}
          >
            {primaryLabel()}
          </button>
        </div>
      </div>
    </>
  )
}
