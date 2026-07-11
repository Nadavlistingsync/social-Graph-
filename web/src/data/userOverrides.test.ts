import { beforeEach, describe, expect, it } from 'vitest'
import { effectiveWarmth, isKnown, resetOverrides, setKnown } from './userOverrides'
import { getNode } from './paths'

const jay = () => getNode('jay-neveloff')!
const witkoff = () => getNode('steve-witkoff')!

beforeEach(() => {
  localStorage.clear()
  resetOverrides()
})

describe('isKnown', () => {
  it('falls back to seed defaults', () => {
    expect(isKnown(jay())).toBe(true)
    expect(isKnown(witkoff())).toBe(false)
  })

  it('user override wins over seed data', () => {
    setKnown(witkoff(), true)
    expect(isKnown(witkoff())).toBe(true)

    setKnown(jay(), false)
    expect(isKnown(jay())).toBe(false)
  })

  it('setting back to the seed default removes the stored override', () => {
    setKnown(witkoff(), true)
    setKnown(witkoff(), false)
    const raw = localStorage.getItem('sg-known-overrides')
    expect(raw).toBe('{}')
  })
})

describe('effectiveWarmth', () => {
  it('uses seed warmth for known people', () => {
    expect(effectiveWarmth(jay())).toBe(0.85)
  })

  it('defaults to 0.7 for known people without explicit warmth', () => {
    setKnown(witkoff(), true)
    expect(effectiveWarmth(witkoff())).toBe(0.7)
  })

  it('is cold for unknown people', () => {
    expect(effectiveWarmth(witkoff())).toBe(0.05)
  })
})

describe('persistence', () => {
  it('writes overrides to localStorage', () => {
    setKnown(witkoff(), true)
    const raw = localStorage.getItem('sg-known-overrides')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).toEqual({ 'steve-witkoff': true })
  })

  it('resetOverrides clears everything', () => {
    setKnown(witkoff(), true)
    resetOverrides()
    expect(isKnown(witkoff())).toBe(false)
  })
})
