import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { GraphEdge, GraphNode } from '../data/types'
import {
  addEdge as storeAddEdge,
  addPerson as storeAddPerson,
  claimLegacyWorkspaceIfNeeded,
  completeOnboarding,
  getEdges,
  getNodes,
  getProfile,
  getYouId,
  importContacts as storeImportContacts,
  isOnboarded,
  migrateLegacyUser,
  resetWorkspace,
  setLoadSample,
  slugify,
  updateProfile,
  type WorkspaceProfile,
} from '../data/graphStore'
import { saveWarmthOverride } from '../data/preferences'
import type { ParsedContact } from '../data/contactImport'
import { useAuth } from './AuthContext'

type GraphContextValue = {
  version: number
  youId: string
  profile: WorkspaceProfile
  isOnboarded: boolean
  nodes: GraphNode[]
  edges: GraphEdge[]
  finishOnboarding: (name: string, loadSample: boolean) => void
  updateProfile: (patch: Partial<WorkspaceProfile>) => void
  setLoadSample: (loadSample: boolean) => void
  addPerson: (
    input: {
      name: string
      summary?: string
      type?: GraphNode['type']
      connectToId?: string
      edgeType?: GraphEdge['type']
      knownByUser?: boolean
    },
  ) => { ok: true; id: string } | { ok: false; error: string }
  addConnection: (input: {
    fromId: string
    toId: string
    type: GraphEdge['type']
    explanation: string
    strength: number
  }) => { ok: true; id: string } | { ok: false; error: string }
  importContacts: (
    contacts: ParsedContact[],
  ) =>
    | { ok: true; imported: number; skipped: number }
    | { ok: false; error: string }
  resetAll: () => void
}

const GraphContext = createContext<GraphContextValue | null>(null)

export function GraphProvider({ children }: { children: ReactNode }) {
  const { version: authVersion } = useAuth()
  const [version, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    claimLegacyWorkspaceIfNeeded()
    migrateLegacyUser()
    bump()
  }, [authVersion, bump])

  const value = useMemo<GraphContextValue>(() => {
    void version
    void authVersion
    const profile = getProfile()
    return {
      version,
      youId: getYouId(),
      profile,
      isOnboarded: isOnboarded(),
      nodes: getNodes(),
      edges: getEdges(),
      finishOnboarding: (name, loadSample) => {
        completeOnboarding(name, loadSample)
        bump()
      },
      updateProfile: (patch) => {
        updateProfile(patch)
        bump()
      },
      setLoadSample: (loadSample) => {
        setLoadSample(loadSample)
        bump()
      },
      addPerson: (input) => {
        const ids = new Set(getNodes().map((n) => n.id))
        const id = slugify(input.name, ids)
        const node: GraphNode = {
          id,
          name: input.name.trim(),
          type: input.type ?? 'person',
          summary: input.summary?.trim() || 'Added to your graph.',
          tags: [],
          timeline: [{ date: new Date().toISOString().slice(0, 7), label: 'Added to your graph' }],
        }
        const connectToId = input.connectToId ?? getYouId()
        let edge: GraphEdge | undefined
        if (connectToId && connectToId !== id) {
          edge = {
            id: `e-${connectToId}-${id}`,
            source: connectToId,
            target: id,
            type: input.edgeType ?? 'partner',
            strength: 0.8,
            recency: new Date().toISOString().slice(0, 10),
            explanation: 'Connection you added.',
            evidence: [
              {
                title: 'Your graph',
                url: '#private',
                snippet: 'Private connection you recorded.',
                date: new Date().toISOString().slice(0, 10),
                quality: 'primary',
              },
            ],
          }
        }
        const result = storeAddPerson(node, edge)
        if (result.ok && input.knownByUser && node.type === 'person') {
          saveWarmthOverride(id, { knownByUser: true, warmth: 0.8 })
        }
        if (result.ok) bump()
        return result
      },
      addConnection: (input) => {
        const edgeId = `e-${input.fromId}-${input.toId}-${input.type}`
        const edge: GraphEdge = {
          id: edgeId,
          source: input.fromId,
          target: input.toId,
          type: input.type,
          strength: input.strength,
          recency: new Date().toISOString().slice(0, 10),
          explanation: input.explanation.trim() || 'Connection you added.',
          evidence: [
            {
              title: 'Your graph',
              url: '#private',
              snippet: 'Private connection you recorded.',
              date: new Date().toISOString().slice(0, 10),
              quality: 'primary',
            },
          ],
        }
        const result = storeAddEdge(edge)
        if (result.ok) bump()
        return result.ok ? { ok: true, id: edgeId } : result
      },
      importContacts: (contacts) => {
        const result = storeImportContacts(contacts)
        if (!result.ok) return result
        for (const id of result.warmthIds) {
          saveWarmthOverride(id, { knownByUser: true, warmth: 0.75 })
        }
        bump()
        return { ok: true, imported: result.imported, skipped: result.skipped }
      },
      resetAll: () => {
        resetWorkspace()
        bump()
      },
    }
  }, [version, authVersion, bump])

  return <GraphContext.Provider value={value}>{children}</GraphContext.Provider>
}

export function useGraph(): GraphContextValue {
  const ctx = useContext(GraphContext)
  if (!ctx) throw new Error('useGraph must be used within GraphProvider')
  return ctx
}
