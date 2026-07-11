import type { ParsedContact } from './contactImport'
import { buildContactSummary, sourceLabel } from './contactImport'
import { YOU_ID, slugify, type Workspace } from './graphStore'
import type { GraphEdge, GraphNode } from './types'

export type ContactImportResult = {
  imported: number
  skipped: number
  warmthIds: string[]
}

export function importContactsIntoWorkspace(
  ws: Workspace,
  existingNodes: GraphNode[],
  contacts: ParsedContact[],
): ContactImportResult {
  const existingNames = new Set(existingNodes.map((n) => n.name.toLowerCase().trim()))
  const existingEmails = new Set(
    existingNodes
      .map((n) => extractEmail(n.summary))
      .filter(Boolean) as string[],
  )
  const existingIds = new Set(existingNodes.map((n) => n.id))

  let imported = 0
  let skipped = 0
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
    if (existingNames.has(name.toLowerCase())) {
      skipped++
      continue
    }
    if (emailKey && existingEmails.has(emailKey)) {
      skipped++
      continue
    }

    const id = slugify(name, existingIds)
    existingIds.add(id)
    existingNames.add(name.toLowerCase())
    if (emailKey) existingEmails.add(emailKey)

    const node: GraphNode = {
      id,
      name,
      type: 'person',
      summary: buildContactSummary(contact),
      tags: [],
      timeline: [{ date: month, label: `Imported from ${sourceLabel(contact.source)}` }],
    }
    ws.customNodes.push(node)

    const edge: GraphEdge = {
      id: `e-${YOU_ID}-${id}`,
      source: YOU_ID,
      target: id,
      type: 'partner',
      strength: 0.8,
      recency: today,
      explanation: 'Imported from your contacts.',
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

  return { imported, skipped, warmthIds }
}

function extractEmail(summary: string): string | undefined {
  const match = summary.match(/[\w.+-]+@[\w.-]+\.\w+/)
  return match?.[0]?.toLowerCase()
}
