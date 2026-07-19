import type { WarmthOverride } from './preferences'

export type RelationshipScore = {
  score: number
  reason: string
  source: 'ai' | 'user' | 'heuristic' | 'import'
  confirmed?: boolean
  ratedAt?: string
}

/** Map 1–10 “how well you know them” → warmth 0–1 + knownByUser. */
export function scoreToWarmth(score: number): WarmthOverride {
  const clamped = Math.max(1, Math.min(10, Math.round(score)))
  return {
    knownByUser: clamped >= 4,
    warmth: clamped / 10,
    score: clamped,
  }
}

export function applyScoreToOverride(
  score: number,
  meta: { reason: string; source: RelationshipScore['source']; confirmed?: boolean },
): WarmthOverride {
  const base = scoreToWarmth(score)
  return {
    ...base,
    reason: meta.reason.slice(0, 160),
    source: meta.source,
    confirmed: meta.confirmed ?? meta.source === 'user',
    ratedAt: new Date().toISOString(),
  }
}

const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'live.com',
  'msn.com',
])

function emailDomain(email?: string): string | null {
  if (!email || !email.includes('@')) return null
  return email.split('@')[1]?.toLowerCase().trim() || null
}

/** Cheap offline estimate when OpenRouter is unavailable or over quota. */
export function heuristicRateContact(
  contact: {
    name: string
    email?: string
    organization?: string
    note?: string
    source?: string
    summary?: string
  },
  userEmail?: string,
): RelationshipScore {
  let score = 3
  const reasons: string[] = []
  const domain = emailDomain(contact.email)
  const userDomain = emailDomain(userEmail)
  const source = contact.source || ''
  const blob = `${contact.summary || ''} ${contact.note || ''}`.toLowerCase()

  if (source.includes('linkedin')) {
    score = 3
    reasons.push('LinkedIn-only tends cold')
  } else if (source.includes('google') || source.includes('vcard') || source.includes('device')) {
    score = 5
    reasons.push('Address-book contact')
  }

  if (domain && userDomain && domain === userDomain && !PERSONAL_DOMAINS.has(domain)) {
    score = Math.max(score, 7)
    reasons.push('Same work email domain')
  } else if (domain && PERSONAL_DOMAINS.has(domain)) {
    score = Math.max(score, 5)
    reasons.push('Personal email on file')
  } else if (domain) {
    score = Math.max(score, 4)
    reasons.push('Work email on file')
  }

  if (contact.organization) {
    score = Math.min(10, score + 1)
    reasons.push('Has org/company')
  }

  if (/connected 20(1[5-9]|2[0-9])/.test(blob)) {
    // older LinkedIn connections slightly warmer than brand-new
    score = Math.min(10, score + 1)
  }

  if (!contact.email && source.includes('linkedin')) {
    score = Math.min(score, 3)
  }

  score = Math.max(1, Math.min(10, Math.round(score)))
  return {
    score,
    reason: reasons[0] || 'Heuristic estimate',
    source: 'heuristic',
  }
}

export function parseContactFieldsFromSummary(summary: string): {
  email?: string
  organization?: string
  note?: string
} {
  const parts = summary.split(' · ').map((p) => p.trim()).filter(Boolean)
  let email: string | undefined
  let organization: string | undefined
  const notes: string[] = []
  for (const part of parts) {
    if (/^[\w.+-]+@[\w.-]+\.\w+$/.test(part)) email = part.toLowerCase()
    else if (/^Imported from /i.test(part)) notes.push(part)
    else if (!organization && !/@/.test(part) && part.length < 80) organization = part
    else notes.push(part)
  }
  return { email, organization, note: notes.join(' · ') || undefined }
}

export type RateContactInput = {
  id: string
  name: string
  email?: string
  organization?: string
  note?: string
  source?: string
  summary?: string
}

export async function fetchAiStatus(): Promise<{ configured: boolean; model: string | null }> {
  try {
    const res = await fetch('/api/ai?action=status')
    if (!res.ok) return { configured: false, model: null }
    return (await res.json()) as { configured: boolean; model: string | null }
  } catch {
    return { configured: false, model: null }
  }
}

export async function rateContactsBatch(args: {
  userName: string
  userEmail?: string
  contacts: RateContactInput[]
}): Promise<
  | { ok: true; ratings: Array<{ id: string; score: number; reason: string; source: 'ai' }> }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch('/api/ai?action=rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName: args.userName,
        userEmail: args.userEmail,
        contacts: args.contacts.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          organization: c.organization,
          note: c.note,
          source: c.source,
        })),
      }),
    })
    const data = (await res.json()) as {
      ratings?: Array<{ id: string; score: number; reason: string }>
      error?: string
    }
    if (!res.ok) return { ok: false, error: data.error || `Rating failed (${res.status})` }
    const ratings = (data.ratings || []).map((r) => ({
      id: r.id,
      score: r.score,
      reason: r.reason,
      source: 'ai' as const,
    }))
    return { ok: true, ratings }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

/** Rate everyone: AI in batches, heuristic fill on failure. */
export async function rateAllContacts(args: {
  userName: string
  userEmail?: string
  contacts: RateContactInput[]
  batchSize?: number
  onProgress?: (done: number, total: number, mode: 'ai' | 'heuristic') => void
}): Promise<Array<{ id: string; score: number; reason: string; source: RelationshipScore['source'] }>> {
  const batchSize = args.batchSize ?? 35
  const out: Array<{ id: string; score: number; reason: string; source: RelationshipScore['source'] }> = []
  const status = await fetchAiStatus()
  let useAi = status.configured
  let done = 0

  for (let i = 0; i < args.contacts.length; i += batchSize) {
    const slice = args.contacts.slice(i, i + batchSize)
    if (useAi) {
      const result = await rateContactsBatch({
        userName: args.userName,
        userEmail: args.userEmail,
        contacts: slice,
      })
      if (result.ok) {
        out.push(...result.ratings)
        done += slice.length
        args.onProgress?.(done, args.contacts.length, 'ai')
        continue
      }
      // Quota / error → fall back for rest
      useAi = false
    }

    for (const c of slice) {
      const h = heuristicRateContact(c, args.userEmail)
      out.push({ id: c.id, score: h.score, reason: h.reason, source: 'heuristic' })
    }
    done += slice.length
    args.onProgress?.(done, args.contacts.length, 'heuristic')
  }

  return out
}

export function contactFromNode(node: {
  id: string
  name: string
  summary: string
  timeline?: Array<{ label: string }>
}): RateContactInput {
  const fields = parseContactFieldsFromSummary(node.summary)
  const label = node.timeline?.[0]?.label || ''
  let source: string | undefined
  if (/LinkedIn/i.test(label)) source = 'linkedin-csv'
  else if (/Google/i.test(label)) source = 'google-api'
  else if (/Apple|vCard/i.test(label)) source = 'vcard'
  else if (/Outlook|Microsoft/i.test(label)) source = 'microsoft-api'
  return {
    id: node.id,
    name: node.name,
    email: fields.email,
    organization: fields.organization,
    note: fields.note,
    source,
    summary: node.summary,
  }
}
