import { describe, expect, it } from 'vitest'
import { YOU_ID } from './seed'
import { bestFirstHop, findPaths, getEdgesForNode, getNode, otherEnd, searchNodes } from './paths'

describe('findPaths', () => {
  it('returns no paths when target equals the source', () => {
    expect(findPaths(YOU_ID)).toEqual([])
  })

  it('finds at least one path from you to the demo target', () => {
    const paths = findPaths('donald-trump')
    expect(paths.length).toBeGreaterThan(0)
  })

  it('ranks paths best-first by total score', () => {
    const paths = findPaths('donald-trump')
    for (let i = 1; i < paths.length; i++) {
      expect(paths[i - 1].scores.total).toBeGreaterThanOrEqual(paths[i].scores.total)
    }
  })

  it('never revisits a node within a single path', () => {
    const paths = findPaths('donald-trump')
    for (const path of paths) {
      expect(new Set(path.nodeIds).size).toBe(path.nodeIds.length)
    }
  })

  it('every path starts at "you" and ends at the target', () => {
    const paths = findPaths('donald-trump')
    for (const path of paths) {
      expect(path.nodeIds[0]).toBe(YOU_ID)
      expect(path.nodeIds[path.nodeIds.length - 1]).toBe('donald-trump')
    }
  })

  it('respects maxDepth', () => {
    const paths = findPaths('donald-trump', { maxDepth: 2 })
    for (const path of paths) {
      expect(path.hops.length).toBeLessThanOrEqual(2)
    }
  })

  it('respects minStrength on every hop', () => {
    const paths = findPaths('donald-trump', { minStrength: 0.8 })
    for (const path of paths) {
      for (const hop of path.hops) {
        expect(hop.edge.strength).toBeGreaterThanOrEqual(0.8)
      }
    }
  })

  it('returns an empty array for an unreachable target', () => {
    expect(findPaths('does-not-exist')).toEqual([])
  })
})

describe('bestFirstHop', () => {
  it('returns null when there are no paths', () => {
    expect(bestFirstHop([])).toBeNull()
  })

  it('surfaces the first hop of the top-ranked path', () => {
    const paths = findPaths('donald-trump')
    const best = bestFirstHop(paths)
    expect(best?.node.id).toBe(paths[0].firstHopId)
  })
})

describe('getNode / getEdgesForNode / otherEnd', () => {
  it('finds an existing node by id', () => {
    expect(getNode(YOU_ID)?.id).toBe(YOU_ID)
  })

  it('returns undefined for a missing node', () => {
    expect(getNode('nope')).toBeUndefined()
  })

  it('collects every edge touching a node', () => {
    const edgesForYou = getEdgesForNode(YOU_ID)
    expect(edgesForYou.length).toBeGreaterThan(0)
    for (const edge of edgesForYou) {
      expect(edge.source === YOU_ID || edge.target === YOU_ID).toBe(true)
    }
  })

  it('otherEnd returns the endpoint that is not the given id', () => {
    const [edge] = getEdgesForNode(YOU_ID)
    expect(otherEnd(edge, YOU_ID)).not.toBe(YOU_ID)
  })
})

describe('searchNodes', () => {
  it('returns people only for an empty query', () => {
    const results = searchNodes('')
    expect(results.length).toBeGreaterThan(0)
    for (const n of results) expect(n.type).toBe('person')
  })

  it('matches by name case-insensitively', () => {
    const results = searchNodes('trump')
    expect(results.some((n) => n.id === 'donald-trump')).toBe(true)
  })

  it('returns nothing for a nonsense query', () => {
    expect(searchNodes('zzzzznotarealquery')).toEqual([])
  })
})
