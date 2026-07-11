import { useEffect, useState } from 'react'
import { nodes } from './seed'

export type ContactPreference = {
  knownByUser: boolean
  warmth: number
}

const storageKey = (id: string) => `sg-contact-${id}`
const changedEvent = 'sg-contact-changed'

function defaultPreference(id: string): ContactPreference {
  const node = nodes.find((candidate) => candidate.id === id)
  return {
    knownByUser: node?.knownByUser ?? false,
    warmth: node?.warmth ?? 0.7,
  }
}

export function getContactPreference(id: string): ContactPreference {
  const fallback = defaultPreference(id)
  if (typeof localStorage === 'undefined') return fallback
  try {
    const stored = localStorage.getItem(storageKey(id))
    if (!stored) return fallback
    const parsed: unknown = JSON.parse(stored)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'knownByUser' in parsed &&
      'warmth' in parsed &&
      typeof parsed.knownByUser === 'boolean' &&
      typeof parsed.warmth === 'number'
    ) {
      return {
        knownByUser: parsed.knownByUser,
        warmth: Math.min(1, Math.max(0, parsed.warmth)),
      }
    }
  } catch {
    // Private-state persistence is optional; keep the seed defaults when unavailable.
  }
  return fallback
}

export function setContactPreference(id: string, preference: ContactPreference) {
  const normalized = {
    knownByUser: preference.knownByUser,
    warmth: Math.min(1, Math.max(0, preference.warmth)),
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(storageKey(id), JSON.stringify(normalized))
    } catch {
      // The current session remains usable if storage is unavailable.
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(changedEvent, { detail: id }))
  }
}

export function useContactPreference(id: string): ContactPreference {
  const [preference, setPreference] = useState(() => getContactPreference(id))

  useEffect(() => {
    setPreference(getContactPreference(id))
    const sync = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail === id) {
        setPreference(getContactPreference(id))
      }
    }
    window.addEventListener(changedEvent, sync)
    return () => window.removeEventListener(changedEvent, sync)
  }, [id])

  return preference
}

export function useContactVersion(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const update = () => setVersion((current) => current + 1)
    window.addEventListener(changedEvent, update)
    return () => window.removeEventListener(changedEvent, update)
  }, [])
  return version
}
