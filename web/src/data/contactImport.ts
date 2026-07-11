export type ContactSource =
  | 'vcard'
  | 'google-csv'
  | 'outlook-csv'
  | 'google-api'
  | 'microsoft-api'
  | 'device-picker'

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

export function detectAndParseContacts(raw: string, filename?: string): ParsedContact[] {
  const trimmed = raw.trim()
  const lower = filename?.toLowerCase() ?? ''

  if (lower.endsWith('.vcf') || trimmed.includes('BEGIN:VCARD')) {
    return parseVcard(raw)
  }

  if (lower.endsWith('.csv') || trimmed.includes(',')) {
    const google = parseGoogleCsv(raw)
    if (google.length > 0) return google
    return parseOutlookCsv(raw)
  }

  if (trimmed.includes('BEGIN:VCARD')) return parseVcard(raw)
  return []
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
    case 'vcard':
      return 'vCard'
  }
}
