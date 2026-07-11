import { describe, expect, it, beforeEach } from 'vitest'
import {
  getGoogleClientId,
  getMicrosoftClientId,
  saveOAuthUserConfig,
} from '../lib/oauthConfig'

beforeEach(() => {
  localStorage.clear()
})

describe('oauthConfig', () => {
  it('reads user-stored Google client ID', () => {
    saveOAuthUserConfig({ googleClientId: 'test-google.apps.googleusercontent.com' })
    expect(getGoogleClientId()).toBe('test-google.apps.googleusercontent.com')
  })

  it('reads user-stored Microsoft client ID', () => {
    saveOAuthUserConfig({ microsoftClientId: 'ms-client-123' })
    expect(getMicrosoftClientId()).toBe('ms-client-123')
  })
})
