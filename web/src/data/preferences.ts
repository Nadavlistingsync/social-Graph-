import { loadWorkspaceState, saveWorkspaceState, type Workspace } from './graphStore'
import { notifyUserDataChanged } from './syncBus'

export type WarmthOverride = { knownByUser: boolean; warmth: number }

const WARMTH_KEY = 'sg-warmth-v1'
const AWKWARD_KEY = 'sg-awkward-edges-v1'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown, sync = true): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / private mode */
  }
  if (sync) notifyUserDataChanged()
}

export function loadWarmthOverrides(): Record<string, WarmthOverride> {
  return readJson(WARMTH_KEY, {})
}

export function saveWarmthOverride(id: string, override: WarmthOverride | null): void {
  const all = loadWarmthOverrides()
  if (override === null) {
    delete all[id]
  } else {
    all[id] = override
  }
  writeJson(WARMTH_KEY, all)
}

export function loadAwkwardEdges(): Set<string> {
  return new Set(readJson<string[]>(AWKWARD_KEY, []))
}

export function saveAwkwardEdge(edgeId: string, awkward: boolean): void {
  const all = loadAwkwardEdges()
  if (awkward) all.add(edgeId)
  else all.delete(edgeId)
  writeJson(AWKWARD_KEY, [...all])
}

export function collectNotes(): Record<string, string> {
  const notes: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('sg-notes-')) {
        const id = key.slice('sg-notes-'.length)
        const value = localStorage.getItem(key)
        if (value) notes[id] = value
      }
    }
  } catch {
    /* ignore */
  }
  return notes
}

export function exportUserData(): string {
  return JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      workspace: loadWorkspaceState(),
      warmth: loadWarmthOverrides(),
      awkwardEdges: [...loadAwkwardEdges()],
      notes: collectNotes(),
    },
    null,
    2,
  )
}

export function importUserData(raw: string): { ok: true } | { ok: false; error: string } {
  try {
    const data = JSON.parse(raw) as {
      version?: number
      workspace?: Workspace
      warmth?: Record<string, WarmthOverride>
      awkwardEdges?: string[]
      notes?: Record<string, string>
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'Invalid file format' }
    }
    if (data.workspace) saveWorkspaceState(data.workspace)
    if (data.warmth) writeJson(WARMTH_KEY, data.warmth, false)
    if (data.awkwardEdges) writeJson(AWKWARD_KEY, data.awkwardEdges, false)
    if (data.notes) {
      for (const [id, text] of Object.entries(data.notes)) {
        try {
          localStorage.setItem(`sg-notes-${id}`, text)
        } catch {
          /* ignore */
        }
      }
    }
    notifyUserDataChanged()
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not parse JSON' }
  }
}
