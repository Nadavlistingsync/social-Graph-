import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONTACTS_GATE_KEY, dismissContactsGate, isContactsGateOpen } from '../views/Onboarding'

describe('dismissContactsGate', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('clears the gate and notifies the app to remount routes', () => {
    sessionStorage.setItem(CONTACTS_GATE_KEY, '1')
    sessionStorage.setItem('sg-onboarding-step', 'contacts')
    const spy = vi.fn()
    window.addEventListener('sg-data-reloaded', spy)

    dismissContactsGate()

    expect(isContactsGateOpen()).toBe(false)
    expect(sessionStorage.getItem('sg-onboarding-step')).toBeNull()
    expect(spy).toHaveBeenCalledTimes(1)
    window.removeEventListener('sg-data-reloaded', spy)
  })
})
