import { describe, expect, it } from 'vitest'
import { parsePastedContacts } from './contactImport'
import { heuristicRateContact, scoreToWarmth } from './relationshipScore'

describe('parsePastedContacts', () => {
  it('parses name, email, and angle-bracket forms', () => {
    const contacts = parsePastedContacts(`
Alex Chen, alex@acme.com
Sam Rivera
Jordan Lee <jordan@example.com>
# ignored
`)
    expect(contacts).toHaveLength(3)
    expect(contacts[0]).toMatchObject({ name: 'Alex Chen', email: 'alex@acme.com', source: 'paste' })
    expect(contacts[1]).toMatchObject({ name: 'Sam Rivera' })
    expect(contacts[2]).toMatchObject({ name: 'Jordan Lee', email: 'jordan@example.com' })
  })
})

describe('relationshipScore', () => {
  it('maps 1–10 into warmth + knownByUser', () => {
    expect(scoreToWarmth(3)).toEqual({ knownByUser: false, warmth: 0.3, score: 3 })
    expect(scoreToWarmth(7)).toEqual({ knownByUser: true, warmth: 0.7, score: 7 })
  })

  it('rates same-domain work email higher than LinkedIn-only', () => {
    const cold = heuristicRateContact({ name: 'Pat', source: 'linkedin-csv' }, 'me@acme.com')
    const warm = heuristicRateContact(
      { name: 'Pat', email: 'pat@acme.com', source: 'google-api' },
      'me@acme.com',
    )
    expect(warm.score).toBeGreaterThan(cold.score)
  })
})
