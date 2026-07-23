import { beforeEach, describe, expect, it } from 'vitest'
import { completeOnboarding, resetWorkspace } from './graphStore'
import { bestFirstHop, findPaths } from './paths'
import {
  MEGA_GRAPH_PEOPLE,
  MEGA_JAY_ID,
  MEGA_TRUMP_ID,
  ensureMegaGraph,
  generateMegaGraph,
  getMegaShortestPath,
  getMegaStats,
  resetMegaGraph,
  searchMegaNodes,
} from './megaGraph'

describe('megaGraph', () => {
  beforeEach(() => {
    resetWorkspace()
    resetMegaGraph()
  })

  it('generates 50k people with edges', () => {
    const g = generateMegaGraph(99)
    expect(g.personIds.length).toBe(MEGA_GRAPH_PEOPLE)
    expect(g.edgeCount).toBeGreaterThan(MEGA_GRAPH_PEOPLE)
    expect(g.names[g.indexOf.get(MEGA_TRUMP_ID)!]).toBe('Donald Trump')
    expect(g.names[g.indexOf.get(MEGA_JAY_ID)!]).toBe('Jay Neveloff')
  })

  it('finds a path from you to Donald Trump', () => {
    completeOnboarding('Me', true, 'Donald Trump', true)
    ensureMegaGraph()
    const path = getMegaShortestPath('you', MEGA_TRUMP_ID)
    expect(path).not.toBeNull()
    expect(path![0]).toBe('you')
    expect(path!.at(-1)).toBe(MEGA_TRUMP_ID)
    expect(path!.length).toBeGreaterThan(2)
  })

  it('ranks Jay as best first hop to Trump', () => {
    completeOnboarding('Me', true, 'Donald Trump', true)
    ensureMegaGraph()
    const paths = findPaths(MEGA_TRUMP_ID, { maxDepth: 12, maxPaths: 3, minStrength: 0.35 })
    const verdict = bestFirstHop(paths)
    expect(verdict?.node.id).toBe(MEGA_JAY_ID)
  })

  it('searches names across the network', () => {
    ensureMegaGraph()
    const hits = searchMegaNodes('Trump', 5)
    expect(hits.some((n) => n.id === MEGA_TRUMP_ID)).toBe(true)
  })

  it('exposes network stats', () => {
    completeOnboarding('Me', true, undefined, true)
    ensureMegaGraph()
    const stats = getMegaStats()
    expect(stats.people).toBe(50_000)
    expect(stats.yourContacts).toBeGreaterThan(40)
  })
})
