import { demoEdges, demoNodes } from './seed'
import {
  ensureMegaGraph,
  getMegaEdgesForNodes,
  getMegaKnownIds,
  getMegaNeighbors,
  getMegaStats,
  getMegaVisibleNodes,
  resetMegaGraph,
} from './megaGraph'
import { importContactsIntoWorkspace, type ContactImportResult } from './contactImportBatch'
import type { ParsedContact } from './contactImport'
import {
  candidatesFromNodes,
  mergeEnrichmentIntoGraph,
  type EnrichmentCandidate,
} from './enrichment'
import type { GraphEdge, GraphNode } from './types'
import { notifyUserDataChanged } from './syncBus'

export const YOU_ID = 'you'
const WORKSPACE_KEY = 'sg-workspace-v2'

export type WorkspaceProfile = {
  name: string
  summary: string
  onboarded: boolean
  loadSample: boolean
  /** 50k procedural demo network */
  megaSample?: boolean
  /** Who you're trying to meet — sets pathfinding intent */
  targetPerson?: string
}

export type Workspace = {
  profile: WorkspaceProfile
  customNodes: GraphNode[]
  customEdges: GraphEdge[]
}

const defaultWorkspace = (): Workspace => ({
  profile: {
    name: '',
    summary: 'You. Center of your graph. Mark warmth on people you actually know.',
    onboarded: false,
    loadSample: true,
  },
  customNodes: [],
  customEdges: [],
})

function readWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY)
    if (!raw) return defaultWorkspace()
    const parsed = JSON.parse(raw) as Workspace
    if (!parsed?.profile) return defaultWorkspace()
    return {
      profile: { ...defaultWorkspace().profile, ...parsed.profile },
      customNodes: parsed.customNodes ?? [],
      customEdges: parsed.customEdges ?? [],
    }
  } catch {
    return defaultWorkspace()
  }
}

function writeWorkspace(ws: Workspace, options?: { silent?: boolean }): void {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws))
  } catch {
    /* ignore */
  }
  if (!options?.silent) notifyUserDataChanged()
}

export function getYouId(): string {
  return YOU_ID
}

export function isOnboarded(): boolean {
  return readWorkspace().profile.onboarded
}

export function getProfile(): WorkspaceProfile {
  return readWorkspace().profile
}

export function createYouNode(profile: WorkspaceProfile): GraphNode {
  return {
    id: YOU_ID,
    name: profile.name || 'You',
    type: 'person',
    summary: profile.summary,
    tags: [],
    knownByUser: true,
    warmth: 1,
    timeline: [{ date: new Date().toISOString().slice(0, 7), label: 'Started your social graph' }],
  }
}

function stripDemoPersonalFields(node: GraphNode): GraphNode {
  const { knownByUser: _k, warmth: _w, privateNotes: _p, ...rest } = node
  return rest
}

export function isMegaSample(): boolean {
  return !!readWorkspace().profile.megaSample
}

export function getNetworkStats(): { people: number; edges: number; yourContacts: number } | null {
  if (!isMegaSample()) return null
  return getMegaStats()
}

export function getNodes(pathIds: string[] = []): GraphNode[] {
  const ws = readWorkspace()
  if (!ws.profile.onboarded) return []
  const you = createYouNode(ws.profile)
  if (ws.profile.megaSample) {
    ensureMegaGraph()
    return [you, ...getMegaVisibleNodes(pathIds)]
  }
  const sample = ws.profile.loadSample ? demoNodes.map(stripDemoPersonalFields) : []
  return [you, ...sample, ...ws.customNodes]
}

export function getEdges(pathIds: string[] = []): GraphEdge[] {
  const ws = readWorkspace()
  if (!ws.profile.onboarded) return []
  if (ws.profile.megaSample) {
    ensureMegaGraph()
    const ids = new Set<string>(['you', ...getMegaKnownIds(), ...pathIds])
    for (const id of pathIds) {
      if (id === 'you') continue
      for (const { nodeId } of getMegaNeighbors(id, 0.15)) {
        ids.add(nodeId)
      }
    }
    return getMegaEdgesForNodes(ids)
  }
  const sample = ws.profile.loadSample ? demoEdges : []
  return [...sample, ...ws.customEdges]
}

export function getCustomNodes(): GraphNode[] {
  return readWorkspace().customNodes
}

export function enrichCustomNetwork(opts?: {
  anchorId?: string
  candidates?: EnrichmentCandidate[]
}): { ok: true; added: number; skipped: number; groups: number } | { ok: false; error: string } {
  const ws = readWorkspace()
  if (!ws.profile.onboarded) return { ok: false, error: 'Complete setup first' }

  const people = ws.customNodes.filter((n) => n.type === 'person')
  if (people.length < 2 && !opts?.candidates?.length) {
    return { ok: true, added: 0, skipped: 0, groups: 0 }
  }

  const existing = getEdges()
  let pool: EnrichmentCandidate[]
  let groups = 0

  if (opts?.candidates?.length) {
    pool = opts.candidates
  } else {
    const local = candidatesFromNodes(people, { anchorId: opts?.anchorId })
    pool = local.candidates
    groups = local.groups.length
  }

  const { edges, added, skipped } = mergeEnrichmentIntoGraph(existing, pool)

  for (const edge of edges) {
    if (!ws.customEdges.some((e) => e.id === edge.id)) {
      ws.customEdges.push(edge)
    }
  }
  if (added > 0) writeWorkspace(ws)
  return { ok: true, added, skipped, groups }
}

export function slugify(name: string, existingIds: Set<string>): string {
  let base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'person'
  let id = base
  let i = 2
  while (existingIds.has(id) || id === YOU_ID) {
    id = `${base}-${i++}`
  }
  return id
}

export function completeOnboarding(
  name: string,
  loadSample: boolean,
  targetPerson?: string,
  megaSample = false,
): void {
  const trimmed = name.trim()
  if (!trimmed) return
  if (megaSample) ensureMegaGraph()
  writeWorkspace({
    profile: {
      name: trimmed,
      summary: defaultWorkspace().profile.summary,
      onboarded: true,
      loadSample: loadSample || megaSample,
      megaSample,
      targetPerson: targetPerson?.trim() || undefined,
    },
    customNodes: [],
    customEdges: [],
  })
}

export function updateProfile(patch: Partial<WorkspaceProfile>): void {
  const ws = readWorkspace()
  ws.profile = { ...ws.profile, ...patch }
  writeWorkspace(ws)
}

export function setLoadSample(loadSample: boolean): void {
  updateProfile({ loadSample })
}

export function addPerson(
  node: GraphNode,
  edge?: GraphEdge,
): { ok: true; id: string } | { ok: false; error: string } {
  const ws = readWorkspace()
  if (!ws.profile.onboarded) return { ok: false, error: 'Complete setup first' }
  const ids = new Set(getNodes().map((n) => n.id))
  if (ids.has(node.id)) return { ok: false, error: 'A person with this id already exists' }
  ws.customNodes.push(node)
  if (edge) ws.customEdges.push(edge)
  writeWorkspace(ws)
  return { ok: true, id: node.id }
}

export function addEdge(edge: GraphEdge): { ok: true } | { ok: false; error: string } {
  const ws = readWorkspace()
  const nodeIds = new Set(getNodes().map((n) => n.id))
  if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
    return { ok: false, error: 'Both people must exist in your graph' }
  }
  if (getEdges().some((e) => e.id === edge.id)) {
    return { ok: false, error: 'This connection already exists' }
  }
  ws.customEdges.push(edge)
  writeWorkspace(ws)
  return { ok: true }
}

export function importContacts(
  contacts: ParsedContact[],
): ({ ok: true } & ContactImportResult) | { ok: false; error: string } {
  const ws = readWorkspace()
  if (!ws.profile.onboarded) return { ok: false, error: 'Complete setup first' }
  if (!contacts.length) return { ok: false, error: 'No contacts found in file' }

  const existingNodes = getNodes()
  const result = importContactsIntoWorkspace(ws, existingNodes, contacts)
  writeWorkspace(ws)

  // Link imported contacts who share a work domain or employer (their network).
  if (result.imported + result.merged > 0) {
    enrichCustomNetwork()
  }

  return { ok: true, ...result }
}

export function loadWorkspaceState(): Workspace {
  return readWorkspace()
}

export function saveWorkspaceState(ws: Workspace, options?: { silent?: boolean }): void {
  writeWorkspace(ws, options)
}

export function resetWorkspace(): void {
  try {
    localStorage.removeItem(WORKSPACE_KEY)
    localStorage.removeItem('sg-warmth-v1')
    localStorage.removeItem('sg-awkward-edges-v1')
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith('sg-notes-')) localStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }
  resetMegaGraph()
  notifyUserDataChanged()
}

/** Migrate legacy single-user demo (nadav) to workspace v2 on first load. */
export function migrateLegacyUser(): void {
  if (readWorkspace().profile.onboarded) return
  try {
    const warmth = localStorage.getItem('sg-warmth-v1')
    if (!warmth) return
    const parsed = JSON.parse(warmth) as Record<string, { knownByUser: boolean; warmth: number }>
    if (parsed.nadav) {
      completeOnboarding('You', true)
      const migrated = { ...parsed }
      delete migrated.nadav
      if (Object.keys(migrated).length) {
        localStorage.setItem('sg-warmth-v1', JSON.stringify(migrated))
      }
    }
  } catch {
    /* ignore */
  }
}
