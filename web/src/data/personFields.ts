import type { GraphNode } from './types'

export type PersonFields = {
  id: string
  name: string
  email?: string
  organization?: string
  linkedInUrl?: string
  workDomain?: string
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

const ORG_SUFFIX = /\b(inc|llc|ltd|corp|corporation|co|company|group|holdings|plc)\.?$/i

export function emailDomain(email?: string): string | undefined {
  if (!email?.includes('@')) return undefined
  return email.split('@')[1]?.toLowerCase().trim() || undefined
}

export function isWorkDomain(domain?: string): boolean {
  if (!domain) return false
  return !PERSONAL_DOMAINS.has(domain)
}

export function normalizeOrg(org?: string): string | undefined {
  if (!org) return undefined
  let s = org
    .toLowerCase()
    .trim()
    .replace(/[^\w\s&.-]/g, ' ')
    .replace(/\s+/g, ' ')
  s = s.replace(ORG_SUFFIX, '').trim()
  return s.length >= 2 ? s : undefined
}

export function parseFieldsFromSummary(summary: string): {
  email?: string
  organization?: string
  linkedInUrl?: string
} {
  const parts = summary.split(' · ').map((p) => p.trim()).filter(Boolean)
  let email: string | undefined
  let organization: string | undefined
  let linkedInUrl: string | undefined

  for (const part of parts) {
    if (/^[\w.+-]+@[\w.-]+\.\w+$/.test(part)) {
      email = part.toLowerCase()
      continue
    }
    const li = part.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w%-]+/i)
    if (li) {
      linkedInUrl = li[0].startsWith('http') ? li[0] : `https://${li[0]}`
      continue
    }
    if (/^Imported from /i.test(part) || /^Merged from /i.test(part)) continue
    if (!organization && part.length >= 2 && part.length < 80 && !/@/.test(part)) {
      organization = part
    }
  }

  return { email, organization, linkedInUrl }
}

export function personFieldsFromNode(node: GraphNode): PersonFields {
  const parsed = parseFieldsFromSummary(node.summary || '')
  const domain = emailDomain(parsed.email)
  return {
    id: node.id,
    name: node.name,
    email: parsed.email,
    organization: parsed.organization,
    linkedInUrl: parsed.linkedInUrl,
    workDomain: domain && isWorkDomain(domain) ? domain : undefined,
  }
}
