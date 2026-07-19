import {
  isOpenRouterConfigured,
  openRouterKey,
  openRouterModel,
  openRouterModelFallbacks,
  readJson,
  send,
} from './_lib.js'

const MAX_BATCH = 40

function clampScore(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 3
  return Math.max(1, Math.min(10, Math.round(x)))
}

function extractJson(text) {
  if (!text) return null
  const trimmed = String(text).trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    /* continue */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim())
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf('[')
  const end = trimmed.lastIndexOf(']')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      /* continue */
    }
  }
  return null
}

async function callOpenRouter(model, messages) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openRouterKey()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://social-graph-one.vercel.app',
      'X-Title': 'Social Graph',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 4000,
      messages,
    }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function rateWithOpenRouter({ userName, userEmail, contacts }) {
  const system = `You estimate how well a person likely knows each contact on a 1–10 integer scale.
1 = barely / LinkedIn-only cold, 5 = acquaintance, 8 = close, 10 = inner circle.
Use only the provided fields (name, email, organization, note, source). Be conservative.
Same work email domain as the user → usually 6–8. Google/Apple address-book → often 4–7.
LinkedIn-only with no email → usually 2–4. Never invent private facts.
score MUST be an integer from 1 to 10 (never 0).
Return ONLY a JSON array: [{"id":"...","score":1-10,"reason":"short"}]
Every contact id must appear exactly once. reason max 12 words.`

  const payload = {
    you: { name: userName || 'User', email: userEmail || undefined },
    contacts: contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email || undefined,
      organization: c.organization || undefined,
      note: c.note || undefined,
      source: c.source || undefined,
    })),
  }

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(payload) },
  ]

  const models = openRouterModelFallbacks()
  let lastError = 'All free models failed'

  for (const model of models) {
    const { ok, status, data } = await callOpenRouter(model, messages)
    if (!ok) {
      lastError = data?.error?.message || data?.message || `OpenRouter error (${status})`
      continue
    }

    const content = data?.choices?.[0]?.message?.content
    const parsed = extractJson(content)
    if (!Array.isArray(parsed)) {
      lastError = 'AI returned an unreadable rating list'
      continue
    }

    const byId = new Map()
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue
      const id = String(row.id || '').trim()
      if (!id) continue
      byId.set(id, {
        id,
        score: clampScore(row.score),
        reason: String(row.reason || 'AI estimate').slice(0, 120),
        source: 'ai',
      })
    }

    const results = []
    for (const c of contacts) {
      const hit = byId.get(c.id)
      if (hit) results.push(hit)
      else {
        results.push({
          id: c.id,
          score: 3,
          reason: 'AI miss — conservative default',
          source: 'ai',
        })
      }
    }
    return { ratings: results, model }
  }

  const err = new Error(lastError)
  err.status = 502
  throw err
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    return send(res, 204, '')
  }

  const url = new URL(req.url || '/', 'http://local')
  const action = (url.searchParams.get('action') || '').replace(/^\//, '')

  if (action === 'status' && req.method === 'GET') {
    const key = openRouterKey()
    return send(res, 200, {
      configured: Boolean(key),
      keyLength: key ? key.length : 0,
      model: key ? openRouterModel() : null,
      free: true,
      fallbacks: key ? openRouterModelFallbacks() : [],
    })
  }

  if (action === 'rate' && req.method === 'POST') {
    if (!isOpenRouterConfigured()) {
      return send(res, 503, {
        error:
          'OPENROUTER_API_KEY is missing on the server. In Vercel: Key=OPENROUTER_API_KEY, Value=sk-or-v1-…, then Redeploy.',
      })
    }
    try {
      const body = await readJson(req)
      const contacts = Array.isArray(body.contacts) ? body.contacts : []
      if (!contacts.length) return send(res, 400, { error: 'contacts required' })
      if (contacts.length > MAX_BATCH) {
        return send(res, 400, { error: `Max ${MAX_BATCH} contacts per request` })
      }
      for (const c of contacts) {
        if (!c?.id || !c?.name) return send(res, 400, { error: 'Each contact needs id and name' })
      }
      const { ratings, model } = await rateWithOpenRouter({
        userName: String(body.userName || '').trim(),
        userEmail: String(body.userEmail || '').trim(),
        contacts,
      })
      return send(res, 200, { ratings, model })
    } catch (err) {
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return send(res, status, { error: err instanceof Error ? err.message : 'AI rating failed' })
    }
  }

  return send(res, 404, { error: `Unknown ai action: ${action || '(none)'}` })
}
