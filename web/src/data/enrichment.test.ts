import { describe, expect, it } from 'vitest'
import { buildCoworkerCandidates } from './enrichment'
import { mergeEnrichmentIntoGraph } from './enrichment'
import { normalizeOrg, parseFieldsFromSummary } from './personFields'

describe('personFields', () => {
  it('parses email and org from summary', () => {
    const f = parseFieldsFromSummary('Acme Corp · alex@acme.com · Imported from Google')
    expect(f.email).toBe('alex@acme.com')
    expect(f.organization).toBe('Acme Corp')
  })

  it('normalizes org suffixes', () => {
    expect(normalizeOrg('Acme Corp.')).toBe('acme')
    expect(normalizeOrg('Rivera LLC')).toBe('rivera')
  })
})

describe('buildCoworkerCandidates', () => {
  it('links people with same work domain', () => {
    const result = buildCoworkerCandidates([
      { id: 'a', name: 'Alex', email: 'alex@acme.com', workDomain: 'acme.com' },
      { id: 'b', name: 'Sam', email: 'sam@acme.com', workDomain: 'acme.com' },
      { id: 'c', name: 'Jordan', email: 'jordan@gmail.com' },
    ])
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].reason).toBe('work_domain')
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].label).toBe('@acme.com')
  })

  it('links by organization when domain differs', () => {
    const result = buildCoworkerCandidates([
      { id: 'a', name: 'Alex', organization: 'Acme Corp' },
      { id: 'b', name: 'Sam', organization: 'Acme Inc' },
    ])
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].reason).toBe('organization')
  })

  it('respects anchor filter', () => {
    const result = buildCoworkerCandidates(
      [
        { id: 'a', name: 'Alex', email: 'alex@acme.com', workDomain: 'acme.com' },
        { id: 'b', name: 'Sam', email: 'sam@acme.com', workDomain: 'acme.com' },
        { id: 'c', name: 'Pat', email: 'pat@acme.com', workDomain: 'acme.com' },
      ],
      { anchorId: 'a' },
    )
    expect(result.candidates.every((c) => c.source === 'a' || c.target === 'a')).toBe(true)
  })
})

describe('mergeEnrichmentIntoGraph', () => {
  it('skips duplicate edges', () => {
    const existing = [
      {
        id: 'e-a-b',
        source: 'a',
        target: 'b',
        type: 'partner' as const,
        strength: 0.8,
        recency: '2024-01-01',
        explanation: 'test',
        evidence: [],
      },
    ]
    const { added, skipped } = mergeEnrichmentIntoGraph(existing, [
      {
        source: 'a',
        target: 'b',
        type: 'partner',
        strength: 0.5,
        explanation: 'dup',
        evidence: [],
        reason: 'work_domain',
      },
    ])
    expect(added).toBe(0)
    expect(skipped).toBe(1)
  })
})
