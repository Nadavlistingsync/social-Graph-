const OAUTH_KEY = 'sg-oauth-config-v1'

export type OAuthUserConfig = {
  googleClientId?: string
  microsoftClientId?: string
}

function readUserConfig(): OAuthUserConfig {
  try {
    const raw = localStorage.getItem(OAUTH_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as OAuthUserConfig
  } catch {
    return {}
  }
}

export function saveOAuthUserConfig(patch: OAuthUserConfig): void {
  const next = { ...readUserConfig(), ...patch }
  try {
    localStorage.setItem(OAUTH_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function getGoogleClientId(): string | undefined {
  const env = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const fromEnv = typeof env === 'string' && env.trim() ? env.trim() : undefined
  const fromUser = readUserConfig().googleClientId?.trim()
  return fromEnv || fromUser || undefined
}

export function getMicrosoftClientId(): string | undefined {
  const env = import.meta.env.VITE_MICROSOFT_CLIENT_ID
  const fromEnv = typeof env === 'string' && env.trim() ? env.trim() : undefined
  const fromUser = readUserConfig().microsoftClientId?.trim()
  return fromEnv || fromUser || undefined
}

export function isGoogleContactsAvailable(): boolean {
  return Boolean(getGoogleClientId())
}

export function isMicrosoftContactsAvailable(): boolean {
  return Boolean(getMicrosoftClientId())
}

export function getOAuthUserConfig(): OAuthUserConfig {
  return readUserConfig()
}
