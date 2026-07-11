import type { GraphNode } from './types'

const STORAGE_KEY = 'sg-connections-v1'

export interface ConnectionPreference {
  known: boolean
  warmth: number
}

type StoredPreferences = Record<string, ConnectionPreference>

function clampWarmth(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function readPreferences(): StoredPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as StoredPreferences
  } catch {
    return {}
  }
}

export function getConnectionPreference(node: GraphNode): ConnectionPreference {
  const stored = readPreferences()[node.id]
  if (stored && typeof stored.known === 'boolean' && typeof stored.warmth === 'number') {
    return { known: stored.known, warmth: clampWarmth(stored.warmth) }
  }
  return {
    known: node.knownByUser ?? false,
    warmth: clampWarmth(node.warmth ?? 0.7),
  }
}

export function saveConnectionPreference(
  nodeId: string,
  preference: ConnectionPreference,
): boolean {
  try {
    const current = readPreferences()
    current[nodeId] = {
      known: preference.known,
      warmth: clampWarmth(preference.warmth),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    return true
  } catch {
    return false
  }
}
