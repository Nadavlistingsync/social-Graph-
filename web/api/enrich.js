import {
  isOpenRouterConfigured,
  isOpenRouterKeyValid,
  openRouterKey,
  openRouterModel,
  openRouterModelFallbacks,
  readJson,
  send,
} from './_lib.js'

const MAX_PEOPLE = 80
const MAX_EDGES = 40

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
  const key = openRouterKey()
  if (!isOpenRouterKeyValid(key)) {
    return { ok: false, status: 503, data: { error: { message: 'OpenRouter not configured' } } }
  }
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://social-graph-one.vercel.app',
      'X-Title': 'Social Graph',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 3000,
      messages,
    }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function aiSuggestEdges({ people, anchorId }) {
  const ids = new Set(people.map((p) => p.id))
  const system = `You infer likely professional adjacency between contacts already in a graph.
Rules:
- ONLY output edges between ids in the input list.
- ONLY when shared workDomain OR clearly the same employer/organization (fuzzy: "Acme" = "Acme Inc").
- Do NOT invent news, Instagram follows, or facts not in the input fields.
- Never connect through people not in the list.
- strength 0.35–0.55. quality is "directory" for org/domain matches.
- Return ONLY JSON array: [{"source":"id","target":"id","strength":0.45,"explanation":"short","evidence":[{"title":"Shared employer","url":"#enrichment","snippet":"both list Acme","date":"YYYY-MM-DD","quality":"directory"}]}]
Max ${MAX_EDGES} edges. No markdown.`

  const payload = {
    anchorId: anchorId || undefined,
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email || undefined,
      organization: p.organization || undefined,
      workDomain: p.workDomain || undefined,
      linkedInUrl: p.linkedInUrl || undefined,
    })),
  }

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(payload) },
  ]

  const models = openRouterModelFallbacks()
  let lastError = 'AI enrichment unavailable'

  for (const model of models) {
    const { ok, status, data } = await callOpenRouter(model, messages)
    if (!ok) {
      lastError = data?.error?.message || `OpenRouter error (${status})`
      if (status === 401 || status === 403) break
      continue
    }
    const content = data?.choices?.[0]?.message?.content
    const parsed = extractJson(content)
    if (!Array.isArray(parsed)) {
      lastError = 'AI returned unreadable enrichment'
      continue
    }

    const today = new Date().toISOString().slice(0, 10)
    const edges = []
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue
      const source = String(row.source || '').trim()
      const target = String(row.target || '').trim()
      if (!ids.has(source) || !ids.has(target) || source === target) continue
      if (anchorId && source !== anchorId && target !== anchorId) continue
      const strength = Math.min(0.55, Math.max(0.2, Number(row.strength) || 0.4))
      const explanation = String(row.explanation || 'Likely professional overlap.').slice(0, 200)
      const evidence = Array.isArray(row.evidence)
        ? row.evidence
            .filter((e) => e && typeof e === 'object')
            .slice(0, 2)
            .map((e) => ({
              title: String(e.title || 'Enrichment').slice(0, 80),
              url: String(e.url || '#enrichment').slice(0, 200),
              snippet: String(e.snippet || explanation).slice(0, 200),
              date: String(e.date || today).slice(0, 10),
              quality: ['primary', 'news', 'directory', 'weak'].includes(e.quality)
                ? e.quality
                : 'directory',
            }))
        : [
            {
              title: 'Contact enrichment',
              url: '#enrichment',
              snippet: explanation,
              date: today,
              quality: 'directory',
            },
          ]
      edges.push({ source, target, strength, explanation, evidence })
      if (edges.length >= MAX_EDGES) break
    }
    return { edges, model }
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
    const valid = isOpenRouterConfigured()
    return send(res, 200, {
      configured: valid,
      model: valid ? openRouterModel() : null,
    })
  }

  if (action === 'expand' && req.method === 'POST') {
    if (!isOpenRouterConfigured()) {
      return send(res, 200, { edges: [], model: null, note: 'AI enrichment skipped — OpenRouter not configured' })
    }
    try {
      const body = await readJson(req)
      const people = Array.isArray(body.people) ? body.people : []
      if (!people.length) return send(res, 400, { error: 'people required' })
      if (people.length > MAX_PEOPLE) {
        return send(res, 400, { error: `Max ${MAX_PEOPLE} people per request` })
      }
      for (const p of people) {
        if (!p?.id || !p?.name) return send(res, 400, { error: 'Each person needs id and name' })
      }
      const { edges, model } = await aiSuggestEdges({
        people,
        anchorId: body.anchorId ? String(body.anchorId) : undefined,
      })
      return send(res, 200, { edges, model })
    } catch (err) {
      return send(res, 200, { edges: [], error: err instanceof Error ? err.message : 'AI enrichment failed' })
    }
  }

  return send(res, 404, { error: `Unknown enrich action: ${action || '(none)'}` })
}
