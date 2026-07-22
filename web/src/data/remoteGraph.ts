import { loadSession } from '../lib/authSession'
import { resetWorkspace } from './graphStore'
import {
  localDataHasContent,
  readUserDataBlob,
  writeUserDataBlob,
  type UserDataBlob,
} from './userDataBlob'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

const OWNER_KEY = 'sg-workspace-owner-v1'

function readOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

function writeOwner(userId: string | null): void {
  try {
    if (!userId) localStorage.removeItem(OWNER_KEY)
    else localStorage.setItem(OWNER_KEY, userId)
  } catch {
    /* ignore */
  }
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
  const res = await apiGraph('PUT', {
    version: 2,
    exportedAt: new Date().toISOString(),
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
 * On sign-in: pull cloud graph if present.
 * Never push another account's (or stale anonymous) local blob into a new empty account.
 */
export async function reconcileOnSignIn(userId: string): Promise<'pulled' | 'pushed' | 'empty'> {
  const remote = await fetchRemoteGraph()
  if (remote?.workspace?.profile) {
    writeUserDataBlob(
      {
        version: 2,
        workspace: remote.workspace,
        warmth: remote.warmth ?? {},
        awkwardEdges: remote.awkwardEdges ?? [],
        notes: remote.notes ?? {},
      },
      { silent: true },
    )
    writeOwner(userId)
    return 'pulled'
  }

  const prevOwner = readOwner()
  const local = readUserDataBlob()
  const localOk = localDataHasContent(local)
  const sameOwner = !prevOwner || prevOwner === userId

  if (localOk && sameOwner) {
    await upsertRemoteGraph(local)
    writeOwner(userId)
    return 'pushed'
  }

  // Different user (or leftover anonymous data that isn't ours) — start clean.
  if (localOk && !sameOwner) {
    resetWorkspace()
  }
  writeOwner(userId)
  return 'empty'
}

export async function pushLocalToRemote(userId: string): Promise<void> {
  await upsertRemoteGraph(readUserDataBlob())
  writeOwner(userId)
}
