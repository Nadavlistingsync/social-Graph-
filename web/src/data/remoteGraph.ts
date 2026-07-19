import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import {
  localDataHasContent,
  readUserDataBlob,
  writeUserDataBlob,
  type UserDataBlob,
} from './userDataBlob'

export type RemoteGraphRow = {
  user_id: string
  workspace: UserDataBlob['workspace']
  warmth: UserDataBlob['warmth']
  awkward_edges: string[]
  notes: Record<string, string>
  updated_at: string
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

function rowToBlob(row: RemoteGraphRow): UserDataBlob {
  return {
    version: 2,
    exportedAt: row.updated_at,
    workspace: row.workspace,
    warmth: row.warmth ?? {},
    awkwardEdges: row.awkward_edges ?? [],
    notes: row.notes ?? {},
  }
}

export async function fetchRemoteGraph(userId: string): Promise<RemoteGraphRow | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb
    .from('user_graphs')
    .select('user_id, workspace, warmth, awkward_edges, notes, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data as RemoteGraphRow | null
}

export async function upsertRemoteGraph(userId: string, blob: UserDataBlob): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  const { error } = await sb.from('user_graphs').upsert(
    {
      user_id: userId,
      workspace: blob.workspace,
      warmth: blob.warmth,
      awkward_edges: blob.awkwardEdges,
      notes: blob.notes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

/**
 * On sign-in: remote wins when present; otherwise upload local browser data.
 */
export async function reconcileOnSignIn(userId: string): Promise<'pulled' | 'pushed' | 'empty'> {
  if (!isSupabaseConfigured) return 'empty'
  const remote = await fetchRemoteGraph(userId)
  if (remote?.workspace?.profile) {
    writeUserDataBlob(rowToBlob(remote), { silent: true })
    return 'pulled'
  }
  const local = readUserDataBlob()
  if (localDataHasContent(local)) {
    await upsertRemoteGraph(userId, local)
    return 'pushed'
  }
  return 'empty'
}

export async function pushLocalToRemote(userId: string): Promise<void> {
  await upsertRemoteGraph(userId, readUserDataBlob())
}
