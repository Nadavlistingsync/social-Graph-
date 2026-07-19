import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import {
  localDataHasContent,
  readUserDataBlob,
  writeUserDataBlob,
  type UserDataBlob,
} from './userDataBlob'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

async function accessToken(): Promise<string | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
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
 * On sign-in: remote wins when present; otherwise upload local browser data.
 */
export async function reconcileOnSignIn(_userId: string): Promise<'pulled' | 'pushed' | 'empty'> {
  if (!isSupabaseConfigured) return 'empty'
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
    return 'pulled'
  }
  const local = readUserDataBlob()
  if (localDataHasContent(local)) {
    await upsertRemoteGraph(local)
    return 'pushed'
  }
  return 'empty'
}

export async function pushLocalToRemote(_userId: string): Promise<void> {
  await upsertRemoteGraph(readUserDataBlob())
}
