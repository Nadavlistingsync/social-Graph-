import type { ParsedContact } from './contactImport'
import { buildContactSummary, sourceLabel } from './contactImport'
import { YOU_ID, slugify, type Workspace } from './graphStore'
import type { GraphEdge, GraphNode } from './types'

export type ContactImportResult = {
  imported: number
  skipped: number
  merged: number
  warmthIds: string[]
}

export function importContactsIntoWorkspace(
  ws: Workspace,
  existingNodes: GraphNode[],
  contacts: ParsedContact[],
): ContactImportResult {
  const byName = new Map(existingNodes.map((n) => [n.name.toLowerCase().trim(), n]))
  const byEmail = new Map<string, GraphNode>()
  for (const n of existingNodes) {
    const email = extractEmail(n.summary)
    if (email) byEmail.set(email, n)
  }
  const existingIds = new Set(existingNodes.map((n) => n.id))

  let imported = 0
  let skipped = 0
  let merged = 0
  const warmthIds: string[] = []
  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7)

  for (const contact of contacts) {
    const name = contact.name.trim()
    if (!name || name.length < 2) {
      skipped++
      continue
    }
    const emailKey = contact.email?.toLowerCase().trim()
    const existing =
      (emailKey ? byEmail.get(emailKey) : undefined) || byName.get(name.toLowerCase())

    if (existing) {
      // Merge: enrich summary / timeline; keep id
      const nextSummary = mergeSummaries(existing.summary, buildContactSummary(contact))
      const nodeInCustom = ws.customNodes.find((n) => n.id === existing.id)
      if (nodeInCustom) {
        nodeInCustom.summary = nextSummary
        nodeInCustom.timeline = [
          ...(nodeInCustom.timeline || []),
          { date: month, label: `Merged from ${sourceLabel(contact.source)}` },
        ].slice(-8)
      }
      if (emailKey) byEmail.set(emailKey, existing)
      byName.set(name.toLowerCase(), existing)
      warmthIds.push(existing.id)
      merged++
      continue
    }

    const id = slugify(name, existingIds)
    existingIds.add(id)

    const node: GraphNode = {
      id,
      name,
      type: 'person',
      summary: buildContactSummary(contact),
      tags: [],
      timeline: [{ date: month, label: `Imported from ${sourceLabel(contact.source)}` }],
    }
    ws.customNodes.push(node)
    byName.set(name.toLowerCase(), node)
    if (emailKey) byEmail.set(emailKey, node)

    const edge: GraphEdge = {
      id: `e-${YOU_ID}-${id}`,
      source: YOU_ID,
      target: id,
      type: 'partner',
      strength: 0.55,
      recency: today,
      explanation: 'Imported from your contacts — rate how well you know them.',
      evidence: [
        {
          title: sourceLabel(contact.source),
          url: '#private',
          snippet: 'Private — imported from your address book.',
          date: today,
          quality: 'primary',
        },
      ],
    }
    ws.customEdges.push(edge)
    warmthIds.push(id)
    imported++
  }

  return { imported, skipped, merged, warmthIds }
}

function mergeSummaries(existing: string, incoming: string): string {
  if (!incoming || existing.includes(incoming)) return existing
  if (!existing || /^Imported from /i.test(existing)) return incoming
  const parts = new Set(
    [...existing.split(' · '), ...incoming.split(' · ')].map((p) => p.trim()).filter(Boolean),
  )
  return [...parts].join(' · ')
}

function extractEmail(summary: string): string | undefined {
  const match = summary.match(/[\w.+-]+@[\w.-]+\.\w+/)
  return match?.[0]?.toLowerCase()
}
