import type { ParsedContact } from '../data/contactImport'

type ContactProperty = 'name' | 'email' | 'tel'

type PickedContact = {
  name?: string[]
  email?: string[]
  tel?: string[]
}

type ContactsManager = {
  select: (
    properties: ContactProperty[],
    options?: { multiple?: boolean },
  ) => Promise<PickedContact[]>
}

type NavigatorWithContacts = Navigator & {
  contacts?: ContactsManager
}

export function isDevicePickerAvailable(): boolean {
  const nav = navigator as NavigatorWithContacts
  return typeof nav.contacts?.select === 'function'
}

export async function pickDeviceContacts(): Promise<ParsedContact[]> {
  const nav = navigator as NavigatorWithContacts
  if (!nav.contacts?.select) {
    throw new Error('Contact picker is not supported in this browser.')
  }

  const picked = await nav.contacts.select(['name', 'email', 'tel'], { multiple: true })
  const contacts: ParsedContact[] = []

  for (const entry of picked) {
    const name = entry.name?.[0]?.trim()
    if (!name) continue
    contacts.push({
      name,
      email: entry.email?.[0]?.trim() || undefined,
      note: entry.tel?.[0] ? `Phone: ${entry.tel[0]}` : undefined,
      source: 'device-picker',
    })
  }

  return contacts
}
