import { afterEach, describe, expect, it } from 'vitest'
import { consumeAuthRedirect } from './authRedirect'

function makeJwt(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

describe('consumeAuthRedirect', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/')
    window.location.hash = ''
  })

  it('returns null when no tokens present', () => {
    expect(consumeAuthRedirect()).toBeNull()
  })

  it('parses hash tokens and clears the URL', () => {
    const token = makeJwt({ sub: 'user-1', email: 'a@b.com' })
    window.history.replaceState({}, '', `/#access_token=${token}&refresh_token=r1&expires_in=3600&type=magiclink`)
    // jsdom may not set hash from replaceState path; set explicitly
    window.location.hash = `access_token=${token}&refresh_token=r1&expires_in=3600&type=magiclink`

    const session = consumeAuthRedirect()
    expect(session?.user.id).toBe('user-1')
    expect(session?.user.email).toBe('a@b.com')
    expect(session?.refresh_token).toBe('r1')
    expect(session?.access_token).toBe(token)
    expect(session?.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000))
    expect(window.location.hash).toBe('')
  })

  it('returns null and clears URL on error redirect', () => {
    window.location.hash = 'error=access_denied&error_description=Nope'
    expect(consumeAuthRedirect()).toBeNull()
    expect(window.location.hash).toBe('')
  })
})
