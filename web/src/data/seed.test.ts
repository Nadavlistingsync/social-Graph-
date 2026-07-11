import { describe, expect, it } from 'vitest'
import { edges, nodes, YOU_ID, NODE_TYPE_LABEL } from './seed'

describe('seed data integrity', () => {
  it('has a "you" node that matches YOU_ID', () => {
    const you = nodes.find((n) => n.id === YOU_ID)
    expect(you).toBeDefined()
    expect(you?.knownByUser).toBe(true)
  })

  it('has unique node ids', () => {
    const ids = nodes.map((n) => n.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has unique edge ids', () => {
    const ids = edges.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only references node ids that exist for every edge endpoint', () => {
    const nodeIds = new Set(nodes.map((n) => n.id))
    for (const edge of edges) {
      expect(nodeIds.has(edge.source), `edge ${edge.id} source ${edge.source}`).toBe(true)
      expect(nodeIds.has(edge.target), `edge ${edge.id} target ${edge.target}`).toBe(true)
    }
  })

  it('gives every edge at least one piece of evidence', () => {
    for (const edge of edges) {
      expect(edge.evidence.length, `edge ${edge.id} has no evidence`).toBeGreaterThan(0)
    }
  })

  it('keeps edge strength within [0, 1]', () => {
    for (const edge of edges) {
      expect(edge.strength).toBeGreaterThanOrEqual(0)
      expect(edge.strength).toBeLessThanOrEqual(1)
    }
  })

  it('has a display label for every node type in use', () => {
    for (const node of nodes) {
      expect(NODE_TYPE_LABEL[node.type], `missing label for type ${node.type}`).toBeDefined()
    }
  })
})
