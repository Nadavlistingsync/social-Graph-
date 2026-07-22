import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEMO_BRIDGE_ID,
  DEMO_MODE_KEY,
  exitDemoMode,
  getDemoStep,
  isDemoMode,
  setDemoStep,
  startInvestorDemo,
} from './demoMode'
import { getProfile, isOnboarded, resetWorkspace } from './graphStore'
import { loadWarmthOverrides } from './preferences'

describe('demoMode', () => {
  beforeEach(() => {
    resetWorkspace()
    exitDemoMode()
    sessionStorage.clear()
  })

  it('starts investor demo with sample graph and warm bridge contact', () => {
    startInvestorDemo('Alex Chen')
    expect(isOnboarded()).toBe(true)
    expect(getProfile().name).toBe('Alex Chen')
    expect(getProfile().loadSample).toBe(true)
    expect(getProfile().targetPerson).toBe('Donald Trump')
    expect(isDemoMode()).toBe(true)
    expect(getDemoStep()).toBe(1)
    const warmth = loadWarmthOverrides()[DEMO_BRIDGE_ID]
    expect(warmth?.knownByUser).toBe(true)
    expect(warmth?.score).toBe(8)
  })

  it('tracks demo step changes', () => {
    startInvestorDemo()
    setDemoStep(3)
    expect(getDemoStep()).toBe(3)
    exitDemoMode()
    expect(isDemoMode()).toBe(false)
    expect(sessionStorage.getItem(DEMO_MODE_KEY)).toBeNull()
  })
})
