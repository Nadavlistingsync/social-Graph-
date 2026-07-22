import { personFieldsFromNode, normalizeOrg, type PersonFields } from './personFields'
import type { Evidence, GraphEdge, GraphNode } from './types'

export type EnrichmentCandidate = {
  source: string
  target: string
  type: GraphEdge['type']
  strength: number
  explanation: string
  evidence: Evidence[]
  reason: 'work_domain' | 'organization' | 'ai_public'
}

export type EnrichmentResult = {
  candidates: EnrichmentCandidate[]
  added: number
  skipped: number
  groups: { kind: 'domain' | 'org'; label: string; memberIds: string[] }[]
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function edgeExists(source: string, target: string, existing: Set<string>): boolean {
  return existing.has(pairKey(source, target))
}

function makeEdgeId(source: string, target: string, suffix: string): string {
  const [a, b] = source < target ? [source, target] : [target, source]
  return `e-enrich-${suffix}-${a}-${b}`
}

function titleCaseOrg(org: string): string {
  return org.replace(/\b\w/g, (c) => c.toUpperCase())
}

function coworkerEvidence(label: string, date: string): Evidence[] {
  return [
    {
      title: 'Contact enrichment',
      url: '#enrichment',
      snippet: label,
      date,
      quality: 'directory',
    },
  ]
}

/** Build likely-colleague edges from shared work domains and org names. */
export function buildCoworkerCandidates(
  people: PersonFields[],
  opts?: { anchorId?: string; minGroupSize?: number },
): EnrichmentResult {
  const minGroup = opts?.minGroupSize ?? 2
  const today = new Date().toISOString().slice(0, 10)
  const candidates: EnrichmentCandidate[] = []
  const groups: EnrichmentResult['groups'] = []
  const seenPairs = new Set<string>()

  function addPair(
    a: PersonFields,
    b: PersonFields,
    reason: EnrichmentCandidate['reason'],
    strength: number,
    explanation: string,
    evidenceLabel: string,
  ) {
    if (a.id === b.id) return
    if (opts?.anchorId && a.id !== opts.anchorId && b.id !== opts.anchorId) return
    const key = pairKey(a.id, b.id)
    if (seenPairs.has(key)) return
    seenPairs.add(key)
    candidates.push({
      source: a.id,
      target: b.id,
      type: 'partner',
      strength,
      explanation,
      evidence: coworkerEvidence(evidenceLabel, today),
      reason,
    })
  }

  function clique(
    members: PersonFields[],
    reason: EnrichmentCandidate['reason'],
    strength: number,
    explanation: string,
    evidenceLabel: string,
  ) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        addPair(members[i], members[j], reason, strength, explanation, evidenceLabel)
      }
    }
  }

  const byDomain = new Map<string, PersonFields[]>()
  for (const p of people) {
    if (!p.workDomain) continue
    const list = byDomain.get(p.workDomain) ?? []
    list.push(p)
    byDomain.set(p.workDomain, list)
  }

  for (const [domain, members] of byDomain) {
    if (members.length < minGroup) continue
    groups.push({ kind: 'domain', label: `@${domain}`, memberIds: members.map((m) => m.id) })
    clique(
      members,
      'work_domain',
      0.52,
      `Likely colleagues — shared work email @${domain}.`,
      `Same work email domain @${domain} on imported contacts.`,
    )
  }

  const byOrg = new Map<string, PersonFields[]>()
  for (const p of people) {
    const org = normalizeOrg(p.organization)
    if (!org) continue
    const list = byOrg.get(org) ?? []
    list.push(p)
    byOrg.set(org, list)
  }

  for (const [org, members] of byOrg) {
    if (members.length < minGroup) continue
    const label = titleCaseOrg(org)
    groups.push({ kind: 'org', label, memberIds: members.map((m) => m.id) })
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i]
        const b = members[j]
        const key = pairKey(a.id, b.id)
        if (seenPairs.has(key)) continue
        addPair(
          a,
          b,
          'organization',
          0.44,
          `Likely colleagues — both listed at ${label}.`,
          `Both contacts list ${label} as employer/organization.`,
        )
      }
    }
  }

  return { candidates, added: 0, skipped: 0, groups }
}

export function candidatesFromNodes(
  nodes: GraphNode[],
  opts?: { anchorId?: string },
): EnrichmentResult {
  const people = nodes.filter((n) => n.type === 'person').map(personFieldsFromNode)
  return buildCoworkerCandidates(people, { anchorId: opts?.anchorId })
}

export function candidatesToEdges(candidates: EnrichmentCandidate[]): GraphEdge[] {
  const today = new Date().toISOString().slice(0, 10)
  return candidates.map((c) => {
    const suffix = c.reason === 'work_domain' ? 'domain' : c.reason === 'organization' ? 'org' : 'ai'
    return {
      id: makeEdgeId(c.source, c.target, suffix),
      source: c.source,
      target: c.target,
      type: c.type,
      strength: c.strength,
      recency: today,
      explanation: c.explanation,
      evidence: c.evidence,
    }
  })
}

export function mergeEnrichmentIntoGraph(
  existingEdges: GraphEdge[],
  candidates: EnrichmentCandidate[],
): { edges: GraphEdge[]; added: number; skipped: number } {
  const existingPairs = new Set(existingEdges.map((e) => pairKey(e.source, e.target)))
  const toAdd: GraphEdge[] = []
  let skipped = 0

  for (const c of candidates) {
    if (edgeExists(c.source, c.target, existingPairs)) {
      skipped++
      continue
    }
    const edge = candidatesToEdges([c])[0]
    toAdd.push(edge)
    existingPairs.add(pairKey(c.source, c.target))
  }

  return { edges: toAdd, added: toAdd.length, skipped }
}

export type AiEnrichmentEdge = {
  source: string
  target: string
  type?: GraphEdge['type']
  strength?: number
  explanation: string
  evidence: Evidence[]
}

export function aiEdgesToCandidates(rows: AiEnrichmentEdge[]): EnrichmentCandidate[] {
  return rows.map((row) => ({
    source: row.source,
    target: row.target,
    type: row.type ?? 'partner',
    strength: Math.min(0.75, Math.max(0.2, row.strength ?? 0.38)),
    explanation: row.explanation,
    evidence: row.evidence.length
      ? row.evidence
      : [
          {
            title: 'AI enrichment',
            url: '#enrichment',
            snippet: row.explanation,
            date: new Date().toISOString().slice(0, 10),
            quality: 'weak',
          },
        ],
    reason: 'ai_public' as const,
  }))
}
