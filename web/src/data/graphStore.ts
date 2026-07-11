import { demoEdges, demoNodes } from './seed'
import { importContactsIntoWorkspace, type ContactImportResult } from './contactImportBatch'
import type { ParsedContact } from './contactImport'
import type { GraphEdge, GraphNode } from './types'

export const YOU_ID = 'you'
const WORKSPACE_KEY = 'sg-workspace-v2'

export type WorkspaceProfile = {
  name: string
  summary: string
  onboarded: boolean
  loadSample: boolean
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

function writeWorkspace(ws: Workspace): void {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws))
  } catch {
    /* ignore */
  }
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

export function getNodes(): GraphNode[] {
  const ws = readWorkspace()
  if (!ws.profile.onboarded) return []
  const you = createYouNode(ws.profile)
  const sample = ws.profile.loadSample ? demoNodes.map(stripDemoPersonalFields) : []
  return [you, ...sample, ...ws.customNodes]
}

export function getEdges(): GraphEdge[] {
  const ws = readWorkspace()
  if (!ws.profile.onboarded) return []
  const sample = ws.profile.loadSample ? demoEdges : []
  return [...sample, ...ws.customEdges]
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

export function completeOnboarding(name: string, loadSample: boolean): void {
  const trimmed = name.trim()
  if (!trimmed) return
  writeWorkspace({
    profile: {
      name: trimmed,
      summary: defaultWorkspace().profile.summary,
      onboarded: true,
      loadSample,
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
  return { ok: true, ...result }
}

export function loadWorkspaceState(): Workspace {
  return readWorkspace()
}

export function saveWorkspaceState(ws: Workspace): void {
  writeWorkspace(ws)
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
