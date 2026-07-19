import { getActiveAccountId } from './authStore'
import { loadWorkspaceState, saveWorkspaceState, type Workspace } from './graphStore'

export type WarmthOverride = { knownByUser: boolean; warmth: number }

function warmthKey(): string {
  const id = getActiveAccountId()
  return id ? `sg-warmth-v1:${id}` : 'sg-warmth-v1'
}

function awkwardKey(): string {
  const id = getActiveAccountId()
  return id ? `sg-awkward-edges-v1:${id}` : 'sg-awkward-edges-v1'
}

export function notesStorageKey(personId: string): string {
  const id = getActiveAccountId()
  return id ? `sg-notes:${id}:${personId}` : `sg-notes-${personId}`
}

function notesPrefix(): string {
  const id = getActiveAccountId()
  return id ? `sg-notes:${id}:` : 'sg-notes-'
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadWarmthOverrides(): Record<string, WarmthOverride> {
  return readJson(warmthKey(), {})
}

export function saveWarmthOverride(id: string, override: WarmthOverride | null): void {
  const all = loadWarmthOverrides()
  if (override === null) {
    delete all[id]
  } else {
    all[id] = override
  }
  writeJson(warmthKey(), all)
}

export function loadAwkwardEdges(): Set<string> {
  return new Set(readJson<string[]>(awkwardKey(), []))
}

export function saveAwkwardEdge(edgeId: string, awkward: boolean): void {
  const all = loadAwkwardEdges()
  if (awkward) all.add(edgeId)
  else all.delete(edgeId)
  writeJson(awkwardKey(), [...all])
}

export function collectNotes(): Record<string, string> {
  const notes: Record<string, string> = {}
  const prefix = notesPrefix()
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) {
        const id = key.slice(prefix.length)
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
    if (data.warmth) writeJson(warmthKey(), data.warmth)
    if (data.awkwardEdges) writeJson(awkwardKey(), data.awkwardEdges)
    if (data.notes) {
      for (const [id, text] of Object.entries(data.notes)) {
        try {
          localStorage.setItem(notesStorageKey(id), text)
        } catch {
          /* ignore */
        }
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not parse JSON' }
  }
}
