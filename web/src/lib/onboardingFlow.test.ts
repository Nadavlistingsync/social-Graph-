import { afterEach, describe, expect, it } from 'vitest'
import {
  clearAwaitingContactStep,
  clearFirstRunPending,
  isAwaitingContactStep,
  isFirstRunPending,
  markAwaitingContactStep,
  markFirstRunPending,
} from './onboardingFlow'

afterEach(() => {
  clearAwaitingContactStep()
  clearFirstRunPending()
})

describe('onboardingFlow', () => {
  it('tracks the post-signup contact step in sessionStorage', () => {
    expect(isAwaitingContactStep()).toBe(false)
    markAwaitingContactStep()
    expect(isAwaitingContactStep()).toBe(true)
    clearAwaitingContactStep()
    expect(isAwaitingContactStep()).toBe(false)
  })

  it('tracks first-run banner state', () => {
    expect(isFirstRunPending()).toBe(false)
    markFirstRunPending()
    expect(isFirstRunPending()).toBe(true)
    clearFirstRunPending()
    expect(isFirstRunPending()).toBe(false)
  })
})
