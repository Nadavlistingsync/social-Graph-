import type { ParsedContact } from '../data/contactImport'
import { getGoogleClientId } from './oauthConfig'

const GIS_SCRIPT = 'https://accounts.google.com/gsi/client'
const CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts.readonly'

type GooglePerson = {
  names?: { displayName?: string }[]
  emailAddresses?: { value?: string }[]
  organizations?: { name?: string; title?: string }[]
  biographies?: { value?: string }[]
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
    }
  }
}

let gisLoading: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisLoading) return gisLoading
  gisLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Google sign-in'))
    document.head.appendChild(script)
  })
  return gisLoading
}

function requestAccessToken(clientId: string): Promise<string> {
  return loadGoogleScript().then(
    () =>
      new Promise((resolve, reject) => {
        if (!window.google?.accounts?.oauth2) {
          reject(new Error('Google sign-in unavailable'))
          return
        }
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: CONTACTS_SCOPE,
          callback: (response) => {
            if (response.error) reject(new Error(response.error))
            else if (response.access_token) resolve(response.access_token)
            else reject(new Error('No access token'))
          },
        })
        client.requestAccessToken()
      }),
  )
}

async function fetchConnectionsPage(
  token: string,
  pageToken?: string,
): Promise<{ people: GooglePerson[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    personFields: 'names,emailAddresses,organizations,biographies',
    pageSize: '1000',
  })
  if (pageToken) params.set('pageToken', pageToken)
  const res = await fetch(`https://people.googleapis.com/v1/people/me/connections?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `Google Contacts error (${res.status})`)
  }
  const data = (await res.json()) as {
    connections?: GooglePerson[]
    nextPageToken?: string
  }
  return { people: data.connections ?? [], nextPageToken: data.nextPageToken }
}

function personToContact(person: GooglePerson): ParsedContact | null {
  const name = person.names?.[0]?.displayName?.trim()
  if (!name) return null
  const email = person.emailAddresses?.[0]?.value?.trim()
  const org = person.organizations?.[0]
  const organization = [org?.name, org?.title].filter(Boolean).join(' · ') || undefined
  const note = person.biographies?.[0]?.value?.trim()
  return {
    name,
    email: email || undefined,
    organization,
    note: note || undefined,
    source: 'google-api',
  }
}

export async function fetchGoogleContacts(): Promise<ParsedContact[]> {
  const clientId = getGoogleClientId()
  if (!clientId) {
    throw new Error('Google sign-in is not set up yet. Add a Client ID in Settings.')
  }
  const token = await requestAccessToken(clientId)
  const contacts: ParsedContact[] = []
  let pageToken: string | undefined
  do {
    const page = await fetchConnectionsPage(token, pageToken)
    for (const person of page.people) {
      const c = personToContact(person)
      if (c) contacts.push(c)
    }
    pageToken = page.nextPageToken
  } while (pageToken)
  return contacts
}
