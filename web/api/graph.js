/**
 * Sync API — verifies the user's JWT, then reads/writes their graph in Postgres
 * (`public.user_graphs`). Apply supabase/migrations/001_user_graphs.sql first.
 * Secrets come only from server .env (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).
 */
import {
  bearer,
  readBody,
  send,
  serviceKey,
  supabaseUrl,
  verifyUser,
} from './_lib.js'

function restHeaders(extra = {}) {
  const key = serviceKey()
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  }
}

async function fetchGraphRow(userId) {
  const url = supabaseUrl()
  return fetch(
    `${url}/rest/v1/user_graphs?user_id=eq.${encodeURIComponent(userId)}&select=workspace,warmth,awkward_edges,notes,updated_at&limit=1`,
    { headers: restHeaders({ Accept: 'application/json' }) },
  )
}

async function upsertGraphRow(userId, blob) {
  const url = supabaseUrl()
  const row = {
    user_id: userId,
    workspace: blob.workspace ?? {},
    warmth: blob.warmth ?? {},
    awkward_edges: blob.awkwardEdges ?? blob.awkward_edges ?? [],
    notes: blob.notes ?? {},
  }
  return fetch(`${url}/rest/v1/user_graphs?on_conflict=user_id`, {
    method: 'POST',
    headers: restHeaders({
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    }),
    body: JSON.stringify(row),
  })
}

function rowToBlob(row) {
  return {
    version: 2,
    exportedAt: row.updated_at || new Date().toISOString(),
    workspace: row.workspace,
    warmth: row.warmth ?? {},
    awkwardEdges: row.awkward_edges ?? [],
    notes: row.notes ?? {},
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    return send(res, 204, '')
  }

  if (!supabaseUrl() || !serviceKey()) {
    return send(res, 503, {
      error: 'Server missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env',
    })
  }

  const token = bearer(req)
  if (!token) return send(res, 401, { error: 'Missing Authorization bearer token' })

  const user = await verifyUser(token)
  if (!user?.id) return send(res, 401, { error: 'Invalid session' })

  try {
    if (req.method === 'GET') {
      const remote = await fetchGraphRow(user.id)
      if (!remote.ok) {
        const text = await remote.text()
        return send(res, 502, {
          error: 'Graph read failed — apply supabase/migrations/001_user_graphs.sql',
          detail: text.slice(0, 300),
        })
      }
      const rows = await remote.json()
      const row = Array.isArray(rows) ? rows[0] : rows
      if (!row?.workspace) return send(res, 404, { error: 'Not found' })
      return send(res, 200, rowToBlob(row))
    }

    if (req.method === 'PUT') {
      const raw = await readBody(req)
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        return send(res, 400, { error: 'Invalid JSON body' })
      }
      if (!parsed || typeof parsed !== 'object' || !parsed.workspace) {
        return send(res, 400, { error: 'Body must include workspace' })
      }
      const remote = await upsertGraphRow(user.id, parsed)
      if (!remote.ok) {
        const text = await remote.text()
        return send(res, 502, {
          error: 'Graph write failed — apply supabase/migrations/001_user_graphs.sql',
          detail: text.slice(0, 300),
        })
      }
      return send(res, 200, { ok: true })
    }

    return send(res, 405, { error: 'Method not allowed' })
  } catch (err) {
    return send(res, 500, { error: err instanceof Error ? err.message : 'Sync error' })
  }
}
