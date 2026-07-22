import { loadSession } from '../lib/authSession'
import {
  localDataHasContent,
  readUserDataBlob,
  writeUserDataBlob,
  type UserDataBlob,
} from './userDataBlob'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

function blobTimestamp(blob: UserDataBlob | null | undefined): number {
  if (!blob?.exportedAt) return 0
  const t = Date.parse(blob.exportedAt)
  return Number.isFinite(t) ? t : 0
}

function remoteHasContent(remote: UserDataBlob | null): boolean {
  if (!remote?.workspace) return false
  return localDataHasContent(remote)
}

async function accessToken(): Promise<string | null> {
  return loadSession()?.access_token ?? null
}

async function apiGraph(method: 'GET' | 'PUT', body?: UserDataBlob): Promise<Response> {
  const token = await accessToken()
  if (!token) throw new Error('Not signed in')
  return fetch('/api/graph', {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

export async function fetchRemoteGraph(): Promise<UserDataBlob | null> {
  const res = await apiGraph('GET')
  if (res.status === 404) return null
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(detail || `Sync read failed (${res.status})`)
  }
  return (await res.json()) as UserDataBlob
}

export async function upsertRemoteGraph(blob: UserDataBlob): Promise<void> {
  const exportedAt = blob.exportedAt || new Date().toISOString()
  const res = await apiGraph('PUT', {
    version: 2,
    exportedAt,
    workspace: blob.workspace,
    warmth: blob.warmth,
    awkwardEdges: blob.awkwardEdges,
    notes: blob.notes,
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(detail || `Sync write failed (${res.status})`)
  }
}

/**
 * Last-write-wins reconcile. Never clobber newer local edits with an older remote.
 */
export async function reconcileOnSignIn(_userId: string): Promise<'pulled' | 'pushed' | 'empty'> {
  const remote = await fetchRemoteGraph()
  const local = readUserDataBlob()
  const localHas = localDataHasContent(local)
  const remoteOk = remoteHasContent(remote)

  if (!remoteOk && !localHas) return 'empty'

  if (!remoteOk && localHas) {
    await upsertRemoteGraph(local)
    return 'pushed'
  }

  if (remoteOk && !localHas) {
    writeUserDataBlob(
      {
        version: 2,
        exportedAt: remote!.exportedAt,
        workspace: remote!.workspace,
        warmth: remote!.warmth ?? {},
        awkwardEdges: remote!.awkwardEdges ?? [],
        notes: remote!.notes ?? {},
      },
      { silent: true },
    )
    return 'pulled'
  }

  const remoteTs = blobTimestamp(remote)
  const localTs = blobTimestamp(local)

  // Prefer local when equal or newer — avoids wiping in-progress edits on re-login.
  if (localTs >= remoteTs) {
    await upsertRemoteGraph(local)
    return 'pushed'
  }

  writeUserDataBlob(
    {
      version: 2,
      exportedAt: remote!.exportedAt,
      workspace: remote!.workspace,
      warmth: remote!.warmth ?? {},
      awkwardEdges: remote!.awkwardEdges ?? [],
      notes: remote!.notes ?? {},
    },
    { silent: true },
  )
  return 'pulled'
}

export async function pushLocalToRemote(_userId: string): Promise<void> {
  await upsertRemoteGraph(readUserDataBlob())
}

/** Exported for unit tests */
export const __test = { blobTimestamp, remoteHasContent }
