import { describe, expect, it } from 'vitest'
import { bestFirstHop, findPaths, getEdgesForNode, getNode, otherEnd, searchNodes } from './paths'
import { edges, nodes, YOU_ID } from './seed'

describe('graph data integrity', () => {
  it('every edge points at real nodes', () => {
    const ids = new Set(nodes.map((n) => n.id))
    for (const edge of edges) {
      expect(ids.has(edge.source), `${edge.id} source ${edge.source}`).toBe(true)
      expect(ids.has(edge.target), `${edge.id} target ${edge.target}`).toBe(true)
    }
  })

  it('has unique node and edge ids', () => {
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length)
    expect(new Set(edges.map((e) => e.id)).size).toBe(edges.length)
  })

  it('keeps every edge strength in the [0, 1] range', () => {
    for (const edge of edges) {
      expect(edge.strength).toBeGreaterThanOrEqual(0)
      expect(edge.strength).toBeLessThanOrEqual(1)
    }
  })
})

describe('findPaths', () => {
  it('returns no paths from a node to itself', () => {
    expect(findPaths(YOU_ID)).toEqual([])
  })

  it('finds a warm path from you to the target cluster center', () => {
    const paths = findPaths('donald-trump')
    expect(paths.length).toBeGreaterThan(0)
    const best = paths[0]
    expect(best.nodeIds[0]).toBe(YOU_ID)
    expect(best.nodeIds[best.nodeIds.length - 1]).toBe('donald-trump')
  })

  it('ranks a path through a known warm contact first', () => {
    const best = bestFirstHop(findPaths('donald-trump'))
    expect(best).not.toBeNull()
    // The only person the user actually knows is Jay Neveloff.
    expect(best?.node.id).toBe('jay-neveloff')
  })

  it('respects maxDepth by never exceeding the hop budget', () => {
    const maxDepth = 3
    for (const path of findPaths('donald-trump', { maxDepth })) {
      expect(path.hops.length).toBeLessThanOrEqual(maxDepth)
    }
  })

  it('never revisits a node within a single path', () => {
    for (const path of findPaths('donald-trump', { maxPaths: 20 })) {
      expect(new Set(path.nodeIds).size).toBe(path.nodeIds.length)
    }
  })

  it('caps the number of returned paths', () => {
    expect(findPaths('donald-trump', { maxPaths: 2 }).length).toBeLessThanOrEqual(2)
  })

  it('filters out edges below the minimum strength', () => {
    const strict = findPaths('donald-trump', { minStrength: 0.9 })
    for (const path of strict) {
      for (const hop of path.hops) {
        expect(hop.edge.strength).toBeGreaterThanOrEqual(0.9)
      }
    }
  })

  it('sorts results by descending total score', () => {
    const paths = findPaths('donald-trump', { maxPaths: 10 })
    for (let i = 1; i < paths.length; i += 1) {
      expect(paths[i - 1].scores.total).toBeGreaterThanOrEqual(paths[i].scores.total)
    }
  })
})

describe('helpers', () => {
  it('getNode resolves known ids and rejects unknown ones', () => {
    expect(getNode(YOU_ID)?.name).toBe('Nadav Benedek')
    expect(getNode('does-not-exist')).toBeUndefined()
  })

  it('otherEnd returns the opposite endpoint of an edge', () => {
    const edge = edges.find((e) => e.id === 'e-nadav-jay')!
    expect(otherEnd(edge, YOU_ID)).toBe('jay-neveloff')
    expect(otherEnd(edge, 'jay-neveloff')).toBe(YOU_ID)
  })

  it('getEdgesForNode returns every edge touching a node', () => {
    const forJay = getEdgesForNode('jay-neveloff')
    expect(forJay.length).toBeGreaterThan(0)
    for (const edge of forJay) {
      expect(edge.source === 'jay-neveloff' || edge.target === 'jay-neveloff').toBe(true)
    }
  })

  it('searchNodes matches by name, case-insensitively', () => {
    const hits = searchNodes('witkoff')
    expect(hits.some((n) => n.id === 'steve-witkoff')).toBe(true)
  })

  it('searchNodes returns only people for an empty query', () => {
    expect(searchNodes('   ').every((n) => n.type === 'person')).toBe(true)
  })

  it('bestFirstHop returns null when there are no paths', () => {
    expect(bestFirstHop([])).toBeNull()
  })
})
