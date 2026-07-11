import { beforeEach, describe, expect, it } from 'vitest'
import { completeOnboarding, getYouId, resetWorkspace } from './graphStore'
import { saveWarmthOverride } from './preferences'
import { bestFirstHop, findPaths, getNode } from './paths'

const YOU_ID = getYouId()

beforeEach(() => {
  localStorage.clear()
  resetWorkspace()
  completeOnboarding('Test User', true)
  saveWarmthOverride('jay-neveloff', { knownByUser: true, warmth: 0.85 })
})

describe('findPaths', () => {
  it('finds a path from you to Donald Trump', () => {
    const paths = findPaths('donald-trump', { maxDepth: 5, maxPaths: 5, minStrength: 0.35 })
    expect(paths.length).toBeGreaterThan(0)
    expect(paths[0].nodeIds[0]).toBe(YOU_ID)
    expect(paths[0].nodeIds.at(-1)).toBe('donald-trump')
  })

  it('ranks Jay Neveloff highly as first hop when warmth is known', () => {
    const paths = findPaths('donald-trump', { maxDepth: 5, maxPaths: 5, minStrength: 0.35 })
    const verdict = bestFirstHop(paths)
    expect(verdict?.node.id).toBe('jay-neveloff')
  })

  it('includes a Sapir branch among strong paths to Trump', () => {
    const paths = findPaths('donald-trump', { maxDepth: 5, maxPaths: 8, minStrength: 0.35 })
    expect(paths.some((p) => p.nodeIds.includes('tamir-sapir'))).toBe(true)
  })

  it('returns a direct path when the target is already known', () => {
    const paths = findPaths('jay-neveloff', { maxDepth: 5, maxPaths: 5, minStrength: 0.35 })
    expect(paths[0]?.nodeIds).toEqual([YOU_ID, 'jay-neveloff'])
    expect(paths[0]?.hops).toHaveLength(1)
  })

  it('returns empty when target is you', () => {
    expect(findPaths(YOU_ID)).toEqual([])
  })
})

describe('getNode', () => {
  it('returns the user node by id', () => {
    const node = getNode(YOU_ID)
    expect(node?.name).toBe('Test User')
  })

  it('returns seeded demo node by id', () => {
    const node = getNode('jay-neveloff')
    expect(node?.name).toBe('Jay Neveloff')
  })
})
