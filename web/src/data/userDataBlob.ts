import {
  loadWorkspaceState,
  saveWorkspaceState,
  type Workspace,
} from './graphStore'
import {
  collectNotes,
  loadAwkwardEdges,
  loadWarmthOverrides,
  type WarmthOverride,
} from './preferences'
import { notifyUserDataChanged } from './syncBus'

export type UserDataBlob = {
  version: 2
  exportedAt?: string
  workspace: Workspace
  warmth: Record<string, WarmthOverride>
  awkwardEdges: string[]
  notes: Record<string, string>
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function readUserDataBlob(): UserDataBlob {
  return {
    version: 2,
    workspace: loadWorkspaceState(),
    warmth: loadWarmthOverrides(),
    awkwardEdges: [...loadAwkwardEdges()],
    notes: collectNotes(),
  }
}

export function writeUserDataBlob(data: UserDataBlob, options?: { silent?: boolean }): void {
  if (data.workspace) saveWorkspaceState(data.workspace, { silent: true })
  if (data.warmth) writeJson('sg-warmth-v1', data.warmth)
  if (data.awkwardEdges) writeJson('sg-awkward-edges-v1', data.awkwardEdges)

  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith('sg-notes-')) localStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }

  if (data.notes) {
    for (const [id, text] of Object.entries(data.notes)) {
      try {
        if (text) localStorage.setItem(`sg-notes-${id}`, text)
      } catch {
        /* ignore */
      }
    }
  }

  if (!options?.silent) notifyUserDataChanged()
}

export function saveNote(nodeId: string, text: string): void {
  try {
    const key = `sg-notes-${nodeId}`
    const prev = localStorage.getItem(key) ?? ''
    if (prev === text) return
    if (text) localStorage.setItem(key, text)
    else localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
  notifyUserDataChanged()
}

export function localDataHasContent(blob: UserDataBlob = readUserDataBlob()): boolean {
  return (
    blob.workspace.profile.onboarded ||
    blob.workspace.customNodes.length > 0 ||
    blob.workspace.customEdges.length > 0 ||
    Object.keys(blob.warmth).length > 0 ||
    blob.awkwardEdges.length > 0 ||
    Object.keys(blob.notes).length > 0
  )
}
