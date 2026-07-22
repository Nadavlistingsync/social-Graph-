import {
  candidatesFromNodes,
  mergeEnrichmentIntoGraph,
  type EnrichmentCandidate,
} from './enrichment'
import { personFieldsFromNode } from './personFields'
import type { GraphEdge, GraphNode } from './types'

export async function fetchAiEnrichment(args: {
  people: ReturnType<typeof personFieldsFromNode>[]
  anchorId?: string
}): Promise<EnrichmentCandidate[]> {
  try {
    const res = await fetch('/api/enrich?action=expand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anchorId: args.anchorId,
        people: args.people.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          organization: p.organization,
          linkedInUrl: p.linkedInUrl,
          workDomain: p.workDomain,
        })),
      }),
    })
    const data = (await res.json()) as {
      edges?: Array<{
        source: string
        target: string
        strength?: number
        explanation: string
        evidence?: Array<{
          title: string
          url: string
          snippet: string
          date: string
          quality: string
        }>
      }>
    }
    if (!res.ok || !data.edges?.length) return []
    return data.edges.map((e) => ({
      source: e.source,
      target: e.target,
      type: 'partner' as const,
      strength: Math.min(0.55, Math.max(0.2, e.strength ?? 0.4)),
      explanation: e.explanation,
      evidence: (e.evidence ?? []).map((ev) => ({
        title: ev.title,
        url: ev.url,
        snippet: ev.snippet,
        date: ev.date,
        quality: (['primary', 'news', 'directory', 'weak'].includes(ev.quality)
          ? ev.quality
          : 'directory') as 'primary' | 'news' | 'directory' | 'weak',
      })),
      reason: 'ai_public' as const,
    }))
  } catch {
    return []
  }
}

export async function buildEnrichmentCandidates(
  nodes: GraphNode[],
  existingEdges: GraphEdge[],
  opts?: { anchorId?: string; useAi?: boolean },
): Promise<{
  candidates: EnrichmentCandidate[]
  groups: number
  wouldAdd: number
  wouldSkip: number
}> {
  const local = candidatesFromNodes(nodes, { anchorId: opts?.anchorId })
  let allCandidates = [...local.candidates]

  if (opts?.useAi !== false) {
    const people = nodes.filter((n) => n.type === 'person').map(personFieldsFromNode)
    const scope =
      opts?.anchorId != null
        ? people.filter(
            (p) =>
              p.id === opts.anchorId ||
              local.groups.some((g) => g.memberIds.includes(p.id)),
          )
        : people
    const ai = await fetchAiEnrichment({ people: scope, anchorId: opts?.anchorId })
    allCandidates = [...allCandidates, ...ai]
  }

  const { added, skipped } = mergeEnrichmentIntoGraph(existingEdges, allCandidates)
  const { edges: newEdges } = mergeEnrichmentIntoGraph(existingEdges, allCandidates)

  return {
    candidates: allCandidates.filter((c) =>
      newEdges.some(
        (e) =>
          (e.source === c.source && e.target === c.target) ||
          (e.source === c.target && e.target === c.source),
      ),
    ),
    groups: local.groups.length,
    wouldAdd: added,
    wouldSkip: skipped,
  }
}
