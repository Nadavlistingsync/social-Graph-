import { describe, expect, it } from 'vitest'
import { completeOnboarding, getNodes, importContacts, resetWorkspace } from './graphStore'
import {
  detectAndParseContacts,
  parseGoogleCsv,
  parseLinkedInCsv,
  parseOutlookCsv,
  parsePastedContacts,
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

const SAMPLE_LINKEDIN_CSV = `Notes:
"When exporting your connection data, LinkedIn notes that…"

First Name,Last Name,Email Address,Company,Position,Connected On
Ada,Lovelace,ada@analytical.engine,Analytical Engine,Mathematician,15 Jan 2020
Grace,Hopper,,US Navy,Rear Admiral,01 Mar 2019
`

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

describe('parseLinkedInCsv', () => {
  it('skips the Notes preamble and maps company/position', () => {
    const contacts = parseLinkedInCsv(SAMPLE_LINKEDIN_CSV)
    expect(contacts).toHaveLength(2)
    expect(contacts[0].name).toBe('Ada Lovelace')
    expect(contacts[0].email).toBe('ada@analytical.engine')
    expect(contacts[0].organization).toBe('Mathematician · Analytical Engine')
    expect(contacts[0].note).toContain('Connected 15 Jan 2020')
    expect(contacts[0].source).toBe('linkedin-csv')
    expect(contacts[1].name).toBe('Grace Hopper')
  })

  it('detects LinkedIn by filename Connections.csv', () => {
    const contacts = detectAndParseContacts(SAMPLE_LINKEDIN_CSV, 'Connections.csv')
    expect(contacts[0].source).toBe('linkedin-csv')
    expect(contacts).toHaveLength(2)
  })
})

describe('detectAndParseContacts', () => {
  it('detects vcf by extension', () => {
    const contacts = detectAndParseContacts(SAMPLE_VCARD, 'contacts.vcf')
    expect(contacts.length).toBeGreaterThan(0)
  })
})

describe('importContacts', () => {
  it('adds contacts to workspace and merges duplicates', () => {
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
    if (second.ok) {
      expect(second.merged).toBe(2)
      expect(second.imported).toBe(0)
    }
  })
})

describe('parsePastedContacts', () => {
  it('parses one name per line with optional emails', () => {
    const contacts = parsePastedContacts(
      'Alex Chen\nSam Rivera, sam@x.com\nJordan Lee <jordan@acme.com>',
    )
    expect(contacts).toHaveLength(3)
    expect(contacts[0]).toMatchObject({ name: 'Alex Chen', source: 'paste' })
    expect(contacts[1]).toMatchObject({ name: 'Sam Rivera', email: 'sam@x.com' })
    expect(contacts[2]).toMatchObject({ name: 'Jordan Lee', email: 'jordan@acme.com' })
  })

  it('splits a comma-separated name list on one line', () => {
    const contacts = parsePastedContacts('Alex Chen, Sam Rivera, Jordan Lee')
    expect(contacts.map((c) => c.name)).toEqual(['Alex Chen', 'Sam Rivera', 'Jordan Lee'])
  })
})
