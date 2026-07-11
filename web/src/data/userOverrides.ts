import { useSyncExternalStore } from 'react'
import type { GraphNode } from './types'

/**
 * Manual layer of the graph: which people the user actually knows.
 * Seed data ships defaults; the user can override per node. Overrides
 * persist in localStorage so they survive reloads without a backend.
 */
const STORAGE_KEY = 'sg-known-overrides'

type Overrides = Record<string, boolean>

let cache: Overrides | null = null
let version = 0
const listeners = new Set<() => void>()

function load(): Overrides {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    cache =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Overrides)
        : {}
  } catch {
    cache = {}
  }
  return cache
}

function persist(next: Overrides) {
  cache = next
  version += 1
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable — overrides stay in memory for this session */
  }
  listeners.forEach((fn) => fn())
}

/** Effective "do I know this person?" — user override wins over seed data. */
export function isKnown(node: GraphNode): boolean {
  const override = load()[node.id]
  return override ?? node.knownByUser ?? false
}

/** Warmth used by ranking when the node is known. */
export function effectiveWarmth(node: GraphNode): number {
  return isKnown(node) ? (node.warmth ?? 0.7) : 0.05
}

export function setKnown(node: GraphNode, known: boolean) {
  const next = { ...load() }
  if (known === (node.knownByUser ?? false)) {
    delete next[node.id]
  } else {
    next[node.id] = known
  }
  persist(next)
}

export function resetOverrides() {
  persist({})
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getVersion() {
  return version
}

/**
 * Returns a version counter that bumps whenever overrides change.
 * Use it as a dependency to recompute memoized paths/rankings.
 */
export function useKnownVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion)
}
