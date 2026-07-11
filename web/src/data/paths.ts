import { loadAwkwardEdges, loadWarmthOverrides } from './preferences'
import { getEdges, getNodes, getYouId } from './graphStore'
import type { EvidenceQuality, GraphEdge, GraphNode, PathHop, RankedPath } from './types'

const qualityScore: Record<EvidenceQuality, number> = {
  primary: 1,
  news: 0.7,
  directory: 0.55,
  weak: 0.25,
}

export function getNode(id: string): GraphNode | undefined {
  const base = getNodes().find((n) => n.id === id)
  if (!base) return undefined
  const override = loadWarmthOverrides()[id]
  if (!override) return base
  return { ...base, knownByUser: override.knownByUser, warmth: override.warmth }
}

export function getEdgesForNode(id: string): GraphEdge[] {
  return getEdges().filter((e) => e.source === id || e.target === id)
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

function implicitKnownEdges(
  awkwardEdges: Set<string>,
  minStrength: number,
): { nodeId: string; edge: GraphEdge }[] {
  const youId = getYouId()
  const results: { nodeId: string; edge: GraphEdge }[] = []
  for (const node of getNodes()) {
    if (node.id === youId) continue
    const effective = getNode(node.id)
    if (!effective?.knownByUser) continue
    const strength = effective.warmth ?? 0.7
    if (strength < minStrength) continue
    const edgeId = `implicit-you-${node.id}`
    if (awkwardEdges.has(edgeId)) continue
    results.push({
      nodeId: node.id,
      edge: {
        id: edgeId,
        source: youId,
        target: node.id,
        type: 'partner',
        strength,
        recency: new Date().toISOString().slice(0, 10),
        explanation: 'Someone you marked as known.',
        evidence: [
          {
            title: 'Your warmth',
            url: '#private',
            snippet: 'Private — you marked this person as known.',
            date: new Date().toISOString().slice(0, 10),
            quality: 'primary',
          },
        ],
      },
    })
  }
  return results
}

function neighbors(
  id: string,
  allowedTypes: Set<string>,
  minStrength: number,
  awkwardEdges: Set<string>,
): { nodeId: string; edge: GraphEdge }[] {
  const explicit = getEdges()
    .filter(
      (e) =>
        (e.source === id || e.target === id) &&
        allowedTypes.has(e.type) &&
        e.strength >= minStrength &&
        !awkwardEdges.has(e.id),
    )
    .map((e) => ({ nodeId: otherEnd(e, id), edge: e }))

  if (id !== getYouId()) return explicit

  const implicit = implicitKnownEdges(awkwardEdges, minStrength).filter((hop) =>
    allowedTypes.has(hop.edge.type),
  )
  const seen = new Set(explicit.map((h) => h.nodeId))
  return [...explicit, ...implicit.filter((h) => !seen.has(h.nodeId))]
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
  const fromId = opts.fromId ?? getYouId()
  const maxDepth = opts.maxDepth ?? 5
  const maxPaths = opts.maxPaths ?? 40
  const minStrength = opts.minStrength ?? 0.15
  const allEdges = getEdges()
  const allowedTypes = new Set(opts.allowedTypes ?? allEdges.map((e) => e.type))
  const awkwardEdges = loadAwkwardEdges()

  if (fromId === targetId) return []

  const found: PathHop[][] = []
  const queue: { path: PathHop[]; visited: Set<string> }[] = [
    { path: [], visited: new Set([fromId]) },
  ]

  while (queue.length && found.length < maxPaths * 3) {
    const { path, visited } = queue.shift()!
    const current = path.length === 0 ? fromId : path[path.length - 1].toId
    if (path.length >= maxDepth) continue

    for (const { nodeId, edge } of neighbors(current, allowedTypes, minStrength, awkwardEdges)) {
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

  const warmth = firstNode?.knownByUser ? (firstNode.warmth ?? 0.7) : 0.05
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
  if (args.warmth >= 0.7) parts.push(`${name} is someone you actually know`)
  else parts.push(`${name} is a cold first hop — mark warmth if you know them`)
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
  const nodes = getNodes()
  const q = query.trim().toLowerCase()
  if (!q) return nodes.filter((n) => n.type === 'person')
  return nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(q) ||
      n.summary.toLowerCase().includes(q) ||
      n.tags.some((t) => t.includes(q)),
  )
}
