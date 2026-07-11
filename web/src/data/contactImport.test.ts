import { describe, expect, it } from 'vitest'
import { completeOnboarding, getNodes, importContacts, resetWorkspace } from './graphStore'
import {
  detectAndParseContacts,
  parseGoogleCsv,
  parseOutlookCsv,
  parseVcard,
} from './contactImport'

const SAMPLE_VCARD = `BEGIN:VCARD
VERSION:3.0
FN:Jane Appleseed
EMAIL:jane@example.com
ORG:Acme Corp
NOTE:Met at conference
END:VCARD
BEGIN:VCARD
VERSION:3.0
N:Doe;John;;;
FN:John Doe
EMAIL:john@example.com
END:VCARD`

const SAMPLE_GOOGLE_CSV = `Name,Given Name,Family Name,E-mail 1 - Value,Organization 1 - Name,Notes
Alice Smith,Alice,Smith,alice@corp.com,Corp Inc,Investor
Bob Jones,Bob,Jones,bob@test.com,,`

describe('parseVcard', () => {
  it('parses Apple-style vCard exports', () => {
    const contacts = parseVcard(SAMPLE_VCARD)
    expect(contacts).toHaveLength(2)
    expect(contacts[0].name).toBe('Jane Appleseed')
    expect(contacts[0].email).toBe('jane@example.com')
    expect(contacts[0].organization).toBe('Acme Corp')
    expect(contacts[1].name).toBe('John Doe')
  })
})

describe('parseGoogleCsv', () => {
  it('parses Google Contacts CSV export', () => {
    const contacts = parseGoogleCsv(SAMPLE_GOOGLE_CSV)
    expect(contacts).toHaveLength(2)
    expect(contacts[0].name).toBe('Alice Smith')
    expect(contacts[0].source).toBe('google-csv')
  })
})

describe('parseOutlookCsv', () => {
  it('parses Outlook CSV with Display Name column', () => {
    const raw = `Display Name,E-mail Address,Company\nPat Lee,pat@co.com,Co LLC`
    const contacts = parseOutlookCsv(raw)
    expect(contacts[0].name).toBe('Pat Lee')
    expect(contacts[0].email).toBe('pat@co.com')
  })
})

describe('detectAndParseContacts', () => {
  it('detects vcf by extension', () => {
    const contacts = detectAndParseContacts(SAMPLE_VCARD, 'contacts.vcf')
    expect(contacts.length).toBeGreaterThan(0)
  })
})

describe('importContacts', () => {
  it('adds contacts to workspace and skips duplicates', () => {
    localStorage.clear()
    resetWorkspace()
    completeOnboarding('Me', false)
    const first = importContacts(parseVcard(SAMPLE_VCARD))
    expect(first.ok).toBe(true)
    if (first.ok) {
      expect(first.imported).toBe(2)
      expect(getNodes().some((n) => n.name === 'Jane Appleseed')).toBe(true)
    }
    const second = importContacts(parseVcard(SAMPLE_VCARD))
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.skipped).toBe(2)
  })
})
