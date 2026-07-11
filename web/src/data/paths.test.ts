import { beforeEach, describe, expect, it } from 'vitest'
import { bestFirstHop, findPaths, getEdgesForNode, getNode, otherEnd, searchNodes } from './paths'
import { resetOverrides, setKnown } from './userOverrides'
import { edges, nodes, YOU_ID } from './seed'

beforeEach(() => {
  localStorage.clear()
  resetOverrides()
})

describe('getNode / getEdgesForNode / otherEnd', () => {
  it('finds a node by id', () => {
    expect(getNode(YOU_ID)?.name).toBe('Nadav Benedek')
  })

  it('returns undefined for unknown ids', () => {
    expect(getNode('nobody')).toBeUndefined()
  })

  it('returns all edges touching a node', () => {
    const rels = getEdgesForNode('jay-neveloff')
    expect(rels.length).toBeGreaterThan(0)
    expect(rels.every((e) => e.source === 'jay-neveloff' || e.target === 'jay-neveloff')).toBe(true)
  })

  it('otherEnd returns the opposite endpoint', () => {
    const edge = edges[0]
    expect(otherEnd(edge, edge.source)).toBe(edge.target)
    expect(otherEnd(edge, edge.target)).toBe(edge.source)
  })
})

describe('findPaths', () => {
  it('finds at least one path from You to the demo target', () => {
    const paths = findPaths('donald-trump')
    expect(paths.length).toBeGreaterThan(0)
    for (const p of paths) {
      expect(p.nodeIds[0]).toBe(YOU_ID)
      expect(p.nodeIds[p.nodeIds.length - 1]).toBe('donald-trump')
    }
  })

  it('returns simple paths (no repeated nodes)', () => {
    const paths = findPaths('donald-trump')
    for (const p of paths) {
      expect(new Set(p.nodeIds).size).toBe(p.nodeIds.length)
    }
  })

  it('ranks paths by descending total score', () => {
    const paths = findPaths('donald-trump')
    const totals = paths.map((p) => p.scores.total)
    expect(totals).toEqual([...totals].sort((a, b) => b - a))
  })

  it('respects maxDepth', () => {
    const paths = findPaths('donald-trump', { maxDepth: 2 })
    for (const p of paths) {
      expect(p.hops.length).toBeLessThanOrEqual(2)
    }
  })

  it('respects maxPaths', () => {
    const paths = findPaths('donald-trump', { maxPaths: 1 })
    expect(paths.length).toBeLessThanOrEqual(1)
  })

  it('respects minStrength', () => {
    const paths = findPaths('donald-trump', { minStrength: 0.6 })
    for (const p of paths) {
      for (const hop of p.hops) {
        expect(hop.edge.strength).toBeGreaterThanOrEqual(0.6)
      }
    }
  })

  it('returns [] when the target is yourself', () => {
    expect(findPaths(YOU_ID)).toEqual([])
  })

  it('returns [] for unreachable targets', () => {
    expect(findPaths('nonexistent-node')).toEqual([])
  })
})

describe('bestFirstHop', () => {
  it('returns null for no paths', () => {
    expect(bestFirstHop([])).toBeNull()
  })

  it('recommends the known bridge person for the demo target', () => {
    const verdict = bestFirstHop(findPaths('donald-trump', { minStrength: 0.35 }))
    expect(verdict?.node.id).toBe('jay-neveloff')
  })
})

describe('ranking reacts to “I know them” overrides', () => {
  it('drops warmth when the user un-marks a known first hop', () => {
    const before = findPaths('donald-trump')[0]
    expect(before.scores.warmth).toBeGreaterThan(0.7)

    const jay = getNode('jay-neveloff')!
    setKnown(jay, false)

    const after = findPaths('donald-trump')[0]
    expect(after.scores.warmth).toBe(0.05)
    expect(after.rationale).toContain('cold first hop')
  })
})

describe('searchNodes', () => {
  it('matches by name (case-insensitive)', () => {
    const results = searchNodes('kushner')
    expect(results.some((n) => n.id === 'jared-kushner')).toBe(true)
    expect(results.some((n) => n.id === 'kushner-companies')).toBe(true)
  })

  it('matches by summary text', () => {
    const results = searchNodes('attorney')
    expect(results.some((n) => n.id === 'jay-neveloff')).toBe(true)
  })

  it('matches by tag', () => {
    const results = searchNodes('bridge person')
    expect(results.some((n) => n.id === 'jay-neveloff')).toBe(true)
  })

  it('returns all people for an empty query', () => {
    const results = searchNodes('   ')
    const people = nodes.filter((n) => n.type === 'person')
    expect(results.length).toBe(people.length)
  })

  it('returns [] when nothing matches', () => {
    expect(searchNodes('zzzz-no-match')).toEqual([])
  })
})
