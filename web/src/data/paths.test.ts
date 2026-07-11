import { describe, expect, it } from 'vitest'
import { bestFirstHop, findPaths } from './paths'
import { YOU_ID } from './seed'

describe('findPaths', () => {
  it('ranks a warm, connected first hop for the default target', () => {
    const paths = findPaths('donald-trump', {
      maxDepth: 5,
      maxPaths: 5,
      minStrength: 0.35,
    })

    expect(paths).not.toHaveLength(0)
    expect(paths[0].nodeIds[0]).toBe(YOU_ID)
    expect(paths[0].nodeIds[1]).toBe('jay-neveloff')
    expect(bestFirstHop(paths)?.node.id).toBe('jay-neveloff')
  })

  it('returns only simple paths and respects the maximum depth', () => {
    const paths = findPaths('donald-trump', { maxDepth: 4, maxPaths: 20, minStrength: 0.15 })

    expect(paths).not.toHaveLength(0)
    for (const path of paths) {
      expect(path.hops.length).toBeLessThanOrEqual(4)
      expect(new Set(path.nodeIds).size).toBe(path.nodeIds.length)
    }
  })

  it('does not invent a path when edge types are disallowed', () => {
    expect(
      findPaths('donald-trump', {
        allowedTypes: ['investor'],
        maxDepth: 5,
      }),
    ).toEqual([])
  })
})
