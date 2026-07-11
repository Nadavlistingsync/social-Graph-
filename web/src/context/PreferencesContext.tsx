import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { GraphNode } from '../data/types'
import {
  exportUserData,
  importUserData,
  loadAwkwardEdges,
  loadWarmthOverrides,
  saveAwkwardEdge,
  saveWarmthOverride,
  type WarmthOverride,
} from '../data/preferences'

type PreferencesContextValue = {
  version: number
  getWarmth: (node: GraphNode) => WarmthOverride
  setWarmth: (id: string, override: WarmthOverride | null) => void
  isAwkward: (edgeId: string) => boolean
  setAwkward: (edgeId: string, awkward: boolean) => void
  exportData: () => string
  importData: (raw: string) => { ok: true } | { ok: false; error: string }
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])

  const value = useMemo<PreferencesContextValue>(() => {
    void version
    const warmthOverrides = loadWarmthOverrides()
    const awkwardEdges = loadAwkwardEdges()

    return {
      version,
      getWarmth: (node: GraphNode) =>
        warmthOverrides[node.id] ?? {
          knownByUser: node.knownByUser ?? false,
          warmth: node.warmth ?? 0.5,
        },
      setWarmth: (id, override) => {
        saveWarmthOverride(id, override)
        bump()
      },
      isAwkward: (edgeId) => awkwardEdges.has(edgeId),
      setAwkward: (edgeId, awkward) => {
        saveAwkwardEdge(edgeId, awkward)
        bump()
      },
      exportData: exportUserData,
      importData: (raw) => {
        const result = importUserData(raw)
        if (result.ok) bump()
        return result
      },
    }
  }, [version, bump])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider')
  return ctx
}
