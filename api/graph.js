/**
 * Sync API — verifies the user's JWT, then reads/writes their graph in Postgres
 * (public.user_graphs). Secrets come only from server .env.
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
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function fetchGraphRow(userId) {
  const url = supabaseUrl()
  const res = await fetch(
    `${url}/rest/v1/user_graphs?user_id=eq.${encodeURIComponent(userId)}&select=*`,
    { method: 'GET', headers: restHeaders({ Accept: 'application/json' }) },
  )
  if (!res.ok) {
    const text = await res.text()
    return { ok: false, status: res.status, text }
  }
  const rows = await res.json()
  return { ok: true, row: Array.isArray(rows) && rows[0] ? rows[0] : null }
}

function rowToBlob(row) {
  return {
    version: 2,
    exportedAt: row.updated_at || undefined,
    workspace: row.workspace ?? {},
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
      const result = await fetchGraphRow(user.id)
      if (!result.ok) {
        return send(res, 502, {
          error: 'Database read failed',
          detail: String(result.text || '').slice(0, 300),
        })
      }
      if (!result.row) return send(res, 404, { error: 'Not found' })
      return send(res, 200, rowToBlob(result.row))
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

      const payload = {
        user_id: user.id,
        workspace: parsed.workspace,
        warmth: parsed.warmth ?? {},
        awkward_edges: parsed.awkwardEdges ?? [],
        notes: parsed.notes ?? {},
        updated_at: parsed.exportedAt || new Date().toISOString(),
      }

      const url = supabaseUrl()
      const remote = await fetch(`${url}/rest/v1/user_graphs`, {
        method: 'POST',
        headers: restHeaders({
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify(payload),
      })
      if (!remote.ok) {
        const text = await remote.text()
        return send(res, 502, {
          error: 'Database write failed',
          detail: text.slice(0, 300),
        })
      }
      return send(res, 200, { ok: true })
    }

    return send(res, 405, { error: 'Method not allowed' })
  } catch (err) {
    return send(res, 500, { error: err instanceof Error ? err.message : 'Server error' })
  }
}
