import { edges, nodes, YOU_ID } from './seed'
import { effectiveWarmth, isKnown } from './userOverrides'
import type { EvidenceQuality, GraphEdge, GraphNode, PathHop, RankedPath } from './types'

const qualityScore: Record<EvidenceQuality, number> = {
  primary: 1,
  news: 0.7,
  directory: 0.55,
  weak: 0.25,
}

export function getNode(id: string): GraphNode | undefined {
  return nodes.find((n) => n.id === id)
}

export function getEdgesForNode(id: string): GraphEdge[] {
  return edges.filter((e) => e.source === id || e.target === id)
}

export function otherEnd(edge: GraphEdge, id: string): string {
  return edge.source === id ? edge.target : edge.source
}

function edgeCredibility(edge: GraphEdge): number {
  if (!edge.evidence.length) return 0
  return Math.max(...edge.evidence.map((ev) => qualityScore[ev.quality]))
}

function recencyScore(iso: string): number {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0.3
  const years = (Date.now() - t) / (365.25 * 24 * 3600 * 1000)
  if (years <= 1) return 1
  if (years <= 3) return 0.8
  if (years <= 7) return 0.55
  if (years <= 15) return 0.35
  return 0.2
}

function neighbors(
  id: string,
  allowedTypes: Set<string>,
  minStrength: number,
): { nodeId: string; edge: GraphEdge }[] {
  return edges
    .filter(
      (e) =>
        (e.source === id || e.target === id) &&
        allowedTypes.has(e.type) &&
        e.strength >= minStrength,
    )
    .map((e) => ({ nodeId: otherEnd(e, id), edge: e }))
}

/** BFS enumeration of simple paths You → target, capped for MVP. */
export function findPaths(
  targetId: string,
  opts: {
    maxDepth?: number
    maxPaths?: number
    minStrength?: number
    allowedTypes?: string[]
    fromId?: string
  } = {},
): RankedPath[] {
  const fromId = opts.fromId ?? YOU_ID
  const maxDepth = opts.maxDepth ?? 5
  const maxPaths = opts.maxPaths ?? 40
  const minStrength = opts.minStrength ?? 0.15
  const allowedTypes = new Set(opts.allowedTypes ?? edges.map((e) => e.type))

  if (fromId === targetId) return []

  const found: PathHop[][] = []
  const queue: { path: PathHop[]; visited: Set<string> }[] = [
    { path: [], visited: new Set([fromId]) },
  ]

  while (queue.length && found.length < maxPaths * 3) {
    const { path, visited } = queue.shift()!
    const current = path.length === 0 ? fromId : path[path.length - 1].toId
    if (path.length >= maxDepth) continue

    for (const { nodeId, edge } of neighbors(current, allowedTypes, minStrength)) {
      if (visited.has(nodeId)) continue
      const hop: PathHop = { fromId: current, toId: nodeId, edge }
      const nextPath = [...path, hop]
      if (nodeId === targetId) {
        found.push(nextPath)
        continue
      }
      const nextVisited = new Set(visited)
      nextVisited.add(nodeId)
      queue.push({ path: nextPath, visited: nextVisited })
    }
  }

  const ranked = found.map((hops, i) => rankPath(hops, i)).sort((a, b) => b.scores.total - a.scores.total)

  return ranked.slice(0, maxPaths)
}

function rankPath(hops: PathHop[], index: number): RankedPath {
  const nodeIds = [hops[0].fromId, ...hops.map((h) => h.toId)]
  const firstHopId = hops[0].toId
  const firstNode = getNode(firstHopId)

  const warmth = firstNode ? effectiveWarmth(firstNode) : 0.05
  const strength =
    hops.reduce((s, h) => s + h.edge.strength, 0) / hops.length
  const credibility =
    hops.reduce((s, h) => s + edgeCredibility(h.edge), 0) / hops.length
  const recency = Math.max(...hops.map((h) => recencyScore(h.edge.recency)))

  const bridgeBonus = firstNode?.tags.includes('bridge person') ? 0.15 : 0
  const powerBonus = firstNode?.tags.includes('power broker') ? 0.1 : 0
  const lengthPenalty = Math.max(0, (hops.length - 2) * 0.08)
  const usefulness = Math.min(1, 0.55 + bridgeBonus + powerBonus + (1 / hops.length) * 0.25 - lengthPenalty)

  const total =
    0.3 * warmth + 0.25 * strength + 0.2 * credibility + 0.15 * recency + 0.1 * usefulness

  const rationale = buildRationale({ warmth, strength, credibility, recency, usefulness, firstNode, hops })

  return {
    id: `path-${index}-${nodeIds.join('-')}`,
    hops,
    nodeIds,
    scores: { warmth, strength, credibility, recency, usefulness, total },
    firstHopId,
    rationale,
  }
}

function buildRationale(args: {
  warmth: number
  strength: number
  credibility: number
  recency: number
  usefulness: number
  firstNode?: GraphNode
  hops: PathHop[]
}): string {
  const name = args.firstNode?.name ?? 'First hop'
  const parts: string[] = []
  if (args.firstNode && isKnown(args.firstNode)) parts.push(`${name} is someone you actually know`)
  else parts.push(`${name} is a cold first hop — mark “I know them” on their page if you do`)
  if (args.strength >= 0.75) parts.push('edge strength along the path is high')
  if (args.credibility >= 0.7) parts.push('evidence quality is solid')
  else if (args.credibility < 0.45) parts.push('evidence is thin — verify before asking')
  if (args.recency >= 0.8) parts.push('includes recent relationships')
  if (args.firstNode?.tags.includes('bridge person')) parts.push('tagged bridge person')
  parts.push(`${args.hops.length} hop${args.hops.length === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

export function bestFirstHop(paths: RankedPath[]): { node: GraphNode; path: RankedPath } | null {
  if (!paths.length) return null
  const best = paths[0]
  const node = getNode(best.firstHopId)
  if (!node) return null
  return { node, path: best }
}

export function searchNodes(query: string): GraphNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes.filter((n) => n.type === 'person')
  return nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(q) ||
      n.summary.toLowerCase().includes(q) ||
      n.tags.some((t) => t.includes(q)),
  )
}
