import type { ParsedContact } from '../data/contactImport'
import { getMicrosoftClientId } from './oauthConfig'

const SCOPES = ['Contacts.Read']

type GraphContact = {
  displayName?: string
  givenName?: string
  surname?: string
  emailAddresses?: { address?: string; name?: string }[]
  companyName?: string
  personalNotes?: string
}

type MsalApp = {
  initialize: () => Promise<void>
  getAllAccounts: () => { homeAccountId: string }[]
  acquireTokenSilent: (req: {
    scopes: string[]
    account: { homeAccountId: string }
  }) => Promise<{ accessToken: string }>
  loginPopup: (req: { scopes: string[] }) => Promise<{ accessToken?: string }>
}

let msalApp: MsalApp | null = null
let msalReady: Promise<MsalApp> | null = null

async function getMsalApp(): Promise<MsalApp> {
  const clientId = getMicrosoftClientId()
  if (!clientId) {
    throw new Error('Microsoft sign-in is not set up yet. Add a Client ID in Settings.')
  }
  if (msalApp) return msalApp
  if (msalReady) return msalReady

  msalReady = (async () => {
    const { PublicClientApplication } = await import('@azure/msal-browser')
    const app = new PublicClientApplication({
      auth: {
        clientId,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'localStorage' },
    }) as unknown as MsalApp
    await app.initialize()
    msalApp = app
    return app
  })()

  return msalReady
}

async function acquireToken(app: MsalApp): Promise<string> {
  const accounts = app.getAllAccounts()
  const account = accounts[0]

  if (account) {
    try {
      const silent = await app.acquireTokenSilent({ scopes: SCOPES, account })
      return silent.accessToken
    } catch {
      /* fall through to popup */
    }
  }

  const login = await app.loginPopup({ scopes: SCOPES })
  if (!login.accessToken) throw new Error('Microsoft sign-in did not return a token')
  return login.accessToken
}

async function fetchContactsPage(
  token: string,
  url?: string,
): Promise<{ contacts: GraphContact[]; next?: string }> {
  const endpoint = url ?? 'https://graph.microsoft.com/v1.0/me/contacts?$top=999'
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `Microsoft Graph error (${res.status})`)
  }
  const data = (await res.json()) as { value?: GraphContact[]; '@odata.nextLink'?: string }
  return { contacts: data.value ?? [], next: data['@odata.nextLink'] }
}

function graphContactToParsed(c: GraphContact): ParsedContact | null {
  let name = c.displayName?.trim()
  if (!name) {
    name = [c.givenName, c.surname].filter(Boolean).join(' ').trim()
  }
  if (!name) return null
  return {
    name,
    email: c.emailAddresses?.[0]?.address?.trim() || undefined,
    organization: c.companyName?.trim() || undefined,
    note: c.personalNotes?.trim() || undefined,
    source: 'microsoft-api',
  }
}

export async function fetchMicrosoftContacts(): Promise<ParsedContact[]> {
  const app = await getMsalApp()
  const token = await acquireToken(app)
  const contacts: ParsedContact[] = []
  let next: string | undefined

  do {
    const page = await fetchContactsPage(token, next)
    for (const c of page.contacts) {
      const parsed = graphContactToParsed(c)
      if (parsed) contacts.push(parsed)
    }
    next = page.next
  } while (next)

  return contacts
}
