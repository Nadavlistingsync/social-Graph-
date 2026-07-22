type Listener = () => void

const listeners = new Set<Listener>()
const UPDATED_AT_KEY = 'sg-updated-at-v1'

export function readUpdatedAt(): string | null {
  try {
    return localStorage.getItem(UPDATED_AT_KEY)
  } catch {
    return null
  }
}

export function touchUpdatedAt(iso?: string): string {
  const value = iso || new Date().toISOString()
  try {
    localStorage.setItem(UPDATED_AT_KEY, value)
  } catch {
    /* ignore */
  }
  return value
}

export function onUserDataChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyUserDataChanged(): void {
  touchUpdatedAt()
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      /* ignore listener errors */
    }
  }
}
