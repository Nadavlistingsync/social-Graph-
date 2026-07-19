/**
 * Sync API — verifies the user's JWT, then reads/writes their graph in Storage.
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

const BUCKET = 'user-graphs'
const OBJECT = 'graph.json'

async function storageFetch(userId, method, body) {
  const url = supabaseUrl()
  const key = serviceKey()
  const path = `${url}/storage/v1/object/${BUCKET}/${userId}/${OBJECT}`
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  }
  if (method === 'POST' || method === 'PUT') {
    headers['Content-Type'] = 'application/json'
    headers['x-upsert'] = 'true'
  }
  return fetch(path, { method, headers, body })
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
      const remote = await storageFetch(user.id, 'GET')
      if (remote.status === 404) return send(res, 404, { error: 'Not found' })
      if (!remote.ok) {
        const text = await remote.text()
        return send(res, 502, { error: 'Storage read failed', detail: text.slice(0, 300) })
      }
      const data = await remote.json()
      return send(res, 200, data)
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
      const remote = await storageFetch(user.id, 'PUT', JSON.stringify(parsed))
      if (!remote.ok) {
        const text = await remote.text()
        return send(res, 502, { error: 'Storage write failed', detail: text.slice(0, 300) })
      }
      return send(res, 200, { ok: true })
    }

    return send(res, 405, { error: 'Method not allowed' })
  } catch (err) {
    return send(res, 500, { error: err instanceof Error ? err.message : 'Server error' })
  }
}
