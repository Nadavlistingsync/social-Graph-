export type ContactSource =
  | 'vcard'
  | 'google-csv'
  | 'outlook-csv'
  | 'linkedin-csv'
  | 'google-api'
  | 'microsoft-api'
  | 'device-picker'
  | 'paste'

export type ParsedContact = {
  name: string
  email?: string
  organization?: string
  note?: string
  source: ContactSource
}

/** Unfold RFC 2426 continuation lines (space-prefixed). */
export function unfoldVcard(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

export function parseVcard(raw: string): ParsedContact[] {
  const text = unfoldVcard(raw)
  const cards = text.split(/BEGIN:VCARD/i).slice(1)
  const contacts: ParsedContact[] = []

  for (const block of cards) {
    const chunk = block.split(/END:VCARD/i)[0] ?? ''
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean)
    let name = ''
    let email = ''
    let organization = ''
    let note = ''

    for (const line of lines) {
      const upper = line.toUpperCase()
      if (upper.startsWith('FN') || upper.startsWith('FN;')) {
        name = vcardValue(line)
      } else if (!name && (upper.startsWith('N') || upper.startsWith('N;'))) {
        const parts = vcardValue(line).split(';').filter(Boolean)
        name = [parts[1], parts[0]].filter(Boolean).join(' ').trim()
      } else if (upper.startsWith('EMAIL') || upper.startsWith('ITEM') && upper.includes('EMAIL')) {
        if (!email) email = vcardValue(line)
      } else if (upper.startsWith('ORG') || upper.startsWith('ORG;')) {
        organization = vcardValue(line).replace(/;/g, ' · ')
      } else if (upper.startsWith('NOTE') || upper.startsWith('NOTE;')) {
        note = vcardValue(line)
      }
    }

    name = name.trim()
    if (!name) continue
    contacts.push({
      name,
      email: email || undefined,
      organization: organization || undefined,
      note: note || undefined,
      source: 'vcard',
    })
  }

  return contacts
}

function vcardValue(line: string): string {
  const idx = line.indexOf(':')
  if (idx === -1) return line.trim()
  let value = line.slice(idx + 1).trim()
  const prop = line.slice(0, idx)
  if (/ENCODING=BASE64/i.test(prop)) {
    try {
      value = atob(value.replace(/\s/g, ''))
    } catch {
      /* keep raw */
    }
  }
  return value
}

/** Parse CSV with quoted fields. */
export function parseCsvRows(raw: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    const next = raw[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i++
      row.push(cell)
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell || row.length) {
    row.push(cell)
    if (row.some((c) => c.trim())) rows.push(row)
  }
  return rows
}

function headerIndex(headers: string[], ...candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim())
  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase())
    if (i >= 0) return i
  }
  for (const c of candidates) {
    const i = lower.findIndex((h) => h.includes(c.toLowerCase()))
    if (i >= 0) return i
  }
  return -1
}

function rowValue(row: string[], idx: number): string {
  if (idx < 0) return ''
  return row[idx]?.trim() ?? ''
}

export function parseGoogleCsv(raw: string): ParsedContact[] {
  const rows = parseCsvRows(raw.replace(/^\uFEFF/, ''))
  if (rows.length < 2) return []
  const headers = rows[0]
  const nameIdx = headerIndex(headers, 'Name', 'File As')
  const givenIdx = headerIndex(headers, 'Given Name', 'First Name')
  const familyIdx = headerIndex(headers, 'Family Name', 'Last Name')
  const emailIdx = headerIndex(headers, 'E-mail 1 - Value', 'Email', 'E-mail Address')
  const orgIdx = headerIndex(headers, 'Organization 1 - Name', 'Organization', 'Company')
  const notesIdx = headerIndex(headers, 'Notes', 'Note')

  const contacts: ParsedContact[] = []
  for (const row of rows.slice(1)) {
    let name = rowValue(row, nameIdx)
    if (!name) {
      name = [rowValue(row, givenIdx), rowValue(row, familyIdx)].filter(Boolean).join(' ')
    }
    name = name.trim()
    if (!name) continue
    contacts.push({
      name,
      email: rowValue(row, emailIdx) || undefined,
      organization: rowValue(row, orgIdx) || undefined,
      note: rowValue(row, notesIdx) || undefined,
      source: 'google-csv',
    })
  }
  return contacts
}

export function parseOutlookCsv(raw: string): ParsedContact[] {
  const rows = parseCsvRows(raw.replace(/^\uFEFF/, ''))
  if (rows.length < 2) return []
  const headers = rows[0]
  const nameIdx = headerIndex(headers, 'Display Name', 'Name', 'Full Name')
  const givenIdx = headerIndex(headers, 'First Name', 'Given Name')
  const familyIdx = headerIndex(headers, 'Last Name', 'Surname', 'Family Name')
  const emailIdx = headerIndex(headers, 'E-mail Address', 'Email Address', 'Email', 'Primary Email')
  const orgIdx = headerIndex(headers, 'Company', 'Organization', 'Organization 1 - Name')
  const notesIdx = headerIndex(headers, 'Notes', 'Categories', 'Comment')

  const contacts: ParsedContact[] = []
  for (const row of rows.slice(1)) {
    let name = rowValue(row, nameIdx)
    if (!name) {
      name = [rowValue(row, givenIdx), rowValue(row, familyIdx)].filter(Boolean).join(' ')
    }
    name = name.trim()
    if (!name) continue
    contacts.push({
      name,
      email: rowValue(row, emailIdx) || undefined,
      organization: rowValue(row, orgIdx) || undefined,
      note: rowValue(row, notesIdx) || undefined,
      source: 'outlook-csv',
    })
  }
  return contacts
}

/** Find the header row in a LinkedIn export (often has a Notes preamble). */
export function findLinkedInHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const lower = rows[i].map((c) => c.toLowerCase().trim())
    const hasFirst = lower.some((h) => h === 'first name')
    const hasLast = lower.some((h) => h === 'last name')
    const hasConnected = lower.some((h) => h.includes('connected on') || h === 'company' || h === 'position')
    if (hasFirst && hasLast && hasConnected) return i
  }
  return -1
}

export function looksLikeLinkedInCsv(raw: string, filename?: string): boolean {
  const lower = filename?.toLowerCase() ?? ''
  if (lower.includes('connection') && lower.endsWith('.csv')) return true
  const sample = raw.slice(0, 4000).toLowerCase()
  if (sample.includes('connected on') && sample.includes('first name')) return true
  if (sample.includes('notes:') && sample.includes('linkedin') && sample.includes('first name')) {
    return true
  }
  return false
}

/**
 * LinkedIn Settings → Data privacy → Get a copy of your data → Connections.
 * Upload the Connections.csv from the unzipped archive.
 */
export function parseLinkedInCsv(raw: string): ParsedContact[] {
  const rows = parseCsvRows(raw.replace(/^\uFEFF/, ''))
  if (rows.length < 2) return []
  const headerIdx = findLinkedInHeaderRow(rows)
  if (headerIdx < 0) return []
  const headers = rows[headerIdx]
  const givenIdx = headerIndex(headers, 'First Name')
  const familyIdx = headerIndex(headers, 'Last Name')
  const emailIdx = headerIndex(headers, 'Email Address', 'Email')
  const companyIdx = headerIndex(headers, 'Company')
  const positionIdx = headerIndex(headers, 'Position', 'Title')
  const connectedIdx = headerIndex(headers, 'Connected On')
  const urlIdx = headerIndex(headers, 'URL', 'Profile URL')

  const contacts: ParsedContact[] = []
  for (const row of rows.slice(headerIdx + 1)) {
    const name = [rowValue(row, givenIdx), rowValue(row, familyIdx)].filter(Boolean).join(' ').trim()
    if (!name || name.toLowerCase() === 'first name last name') continue
    const company = rowValue(row, companyIdx)
    const position = rowValue(row, positionIdx)
    const organization = [position, company].filter(Boolean).join(' · ') || undefined
    const connected = rowValue(row, connectedIdx)
    const url = rowValue(row, urlIdx)
    const noteParts = [
      connected ? `Connected ${connected}` : '',
      url || '',
    ].filter(Boolean)
    contacts.push({
      name,
      email: rowValue(row, emailIdx) || undefined,
      organization,
      note: noteParts.length ? noteParts.join(' · ') : undefined,
      source: 'linkedin-csv',
    })
  }
  return contacts
}

export function detectAndParseContacts(raw: string, filename?: string): ParsedContact[] {
  const trimmed = raw.trim()
  const lower = filename?.toLowerCase() ?? ''

  if (lower.endsWith('.vcf') || trimmed.includes('BEGIN:VCARD')) {
    return parseVcard(raw)
  }

  if (lower.endsWith('.csv') || trimmed.includes(',')) {
    if (looksLikeLinkedInCsv(raw, filename)) {
      const linkedin = parseLinkedInCsv(raw)
      if (linkedin.length > 0) return linkedin
    }
    const rows = parseCsvRows(raw.replace(/^\uFEFF/, ''))
    const headerIdx = findLinkedInHeaderRow(rows)
    if (headerIdx >= 0) {
      const headers = rows[headerIdx].map((h) => h.toLowerCase())
      if (headers.some((h) => h.includes('connected on'))) {
        const linkedin = parseLinkedInCsv(raw)
        if (linkedin.length > 0) return linkedin
      }
    }
    const google = parseGoogleCsv(raw)
    if (google.length > 0) return google
    const outlook = parseOutlookCsv(raw)
    if (outlook.length > 0) return outlook
    return parseLinkedInCsv(raw)
  }

  if (trimmed.includes('BEGIN:VCARD')) return parseVcard(raw)
  return parsePastedContacts(raw)
}

/** Paste lines like `Name` or `Name, email@x.com` or `Name <email@x.com>`. */
export function parsePastedContacts(raw: string): ParsedContact[] {
  const contacts: ParsedContact[] = []
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    let name = trimmed
    let email: string | undefined

    const angle = trimmed.match(/^(.+?)\s*<([\w.+-]+@[\w.-]+\.\w+)>\s*$/)
    if (angle) {
      name = angle[1].trim()
      email = angle[2].toLowerCase()
    } else {
      const comma = trimmed.split(',').map((s) => s.trim())
      if (comma.length >= 2 && /@/.test(comma[comma.length - 1] || '')) {
        email = comma[comma.length - 1].toLowerCase()
        name = comma.slice(0, -1).join(', ')
      } else {
        const spaced = trimmed.match(/^(.+?)\s+([\w.+-]+@[\w.-]+\.\w+)\s*$/)
        if (spaced) {
          name = spaced[1].trim()
          email = spaced[2].toLowerCase()
        }
      }
    }

    name = name.replace(/^["']|["']$/g, '').trim()
    if (name.length < 2) continue
    contacts.push({ name, email, source: 'paste' })
  }
  return contacts
}

export function buildContactSummary(c: ParsedContact): string {
  const parts = [c.organization, c.email, c.note].filter(Boolean)
  if (parts.length) return parts.join(' · ')
  const label =
    c.source === 'google-api'
      ? 'Google Contacts'
      : c.source === 'microsoft-api'
        ? 'Microsoft Outlook'
        : c.source === 'device-picker'
          ? 'your phone'
          : c.source === 'google-csv'
            ? 'Google Contacts export'
            : c.source === 'outlook-csv'
              ? 'Outlook export'
              : c.source === 'linkedin-csv'
                ? 'LinkedIn connections'
                : c.source === 'vcard'
                  ? 'Apple Contacts'
                  : c.source === 'paste'
                    ? 'pasted list'
                    : 'Contacts export'
  return `Imported from ${label}.`
}

export function sourceLabel(source: ContactSource): string {
  switch (source) {
    case 'google-api':
      return 'Google Contacts'
    case 'microsoft-api':
      return 'Microsoft Outlook'
    case 'device-picker':
      return 'Device contacts'
    case 'google-csv':
      return 'Google Contacts CSV'
    case 'outlook-csv':
      return 'Outlook CSV'
    case 'linkedin-csv':
      return 'LinkedIn Connections'
    case 'vcard':
      return 'Apple Contacts (vCard)'
    case 'paste':
      return 'Pasted contacts'
  }
}
