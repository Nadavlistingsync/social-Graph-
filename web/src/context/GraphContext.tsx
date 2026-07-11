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
  completeOnboarding,
  getEdges,
  getNodes,
  getProfile,
  getYouId,
  isOnboarded,
  migrateLegacyUser,
  resetWorkspace,
  setLoadSample,
  slugify,
  updateProfile,
  type WorkspaceProfile,
} from '../data/graphStore'
import { saveWarmthOverride } from '../data/preferences'

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
  resetAll: () => void
}

const GraphContext = createContext<GraphContextValue | null>(null)

export function GraphProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    migrateLegacyUser()
    bump()
  }, [bump])

  const value = useMemo<GraphContextValue>(() => {
    void version
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
      resetAll: () => {
        resetWorkspace()
        bump()
      },
    }
  }, [version, bump])

  return <GraphContext.Provider value={value}>{children}</GraphContext.Provider>
}

export function useGraph(): GraphContextValue {
  const ctx = useContext(GraphContext)
  if (!ctx) throw new Error('useGraph must be used within GraphProvider')
  return ctx
}
