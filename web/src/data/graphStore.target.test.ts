import { afterEach, describe, expect, it } from 'vitest'
import {
  completeOnboarding,
  ensureTargetPerson,
  getCustomPersonIds,
  getNodes,
  resetWorkspace,
  resolveTargetId,
} from './graphStore'

describe('target person wiring', () => {
  afterEach(() => {
    resetWorkspace()
  })

  it('creates a stub target on onboarding and resolves it later', () => {
    completeOnboarding('Alex', false, 'Jordan Lee')
    const nodes = getNodes()
    expect(nodes.some((n) => n.name === 'Jordan Lee')).toBe(true)
    expect(getCustomPersonIds().size).toBe(1)

    const again = ensureTargetPerson('Jordan Lee')
    expect(again?.changed).toBe(false)
    expect(again?.id).toBeTruthy()

    const byId = resolveTargetId(again!.id)
    expect(byId?.id).toBe(again!.id)
    expect(byId?.changed).toBe(false)
  })

  it('reuses sample person when names match', () => {
    completeOnboarding('Alex', true, 'Donald Trump')
    const resolved = resolveTargetId('Donald Trump')
    expect(resolved?.id).toBe('donald-trump')
    // Sample node is not a custom import
    expect(getCustomPersonIds().has('donald-trump')).toBe(false)
  })
})
