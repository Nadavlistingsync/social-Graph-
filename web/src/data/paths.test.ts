import { describe, expect, it } from 'vitest'
import { bestFirstHop, findPaths, getNode } from './paths'
import { YOU_ID } from './seed'

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
    const paths = findPaths('donald-trump', { maxDepth: 5, maxPaths: 10, minStrength: 0.35 })
    expect(paths.some((p) => p.nodeIds.includes('tamir-sapir'))).toBe(true)
  })

  it('returns empty when target is you', () => {
    expect(findPaths(YOU_ID)).toEqual([])
  })
})

describe('getNode', () => {
  it('returns seeded node by id', () => {
    const node = getNode('jay-neveloff')
    expect(node?.name).toBe('Jay Neveloff')
  })
})
