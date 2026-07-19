type Listener = () => void

const listeners = new Set<Listener>()

export function onUserDataChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyUserDataChanged(): void {
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      /* ignore listener errors */
    }
  }
}
