import type { GraphEdge, GraphNode } from './types'

export const MEGA_GRAPH_PEOPLE = 50_000
export const MEGA_TRUMP_ID = 'donald-trump'
export const MEGA_JAY_ID = 'jay-neveloff'
export const MEGA_YOUR_CONTACTS = 48

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Sage', 'Blake',
  'Cameron', 'Drew', 'Emery', 'Finley', 'Harper', 'Jamie', 'Kai', 'Logan', 'Noah', 'Parker',
  'Reese', 'Rowan', 'Skyler', 'Sydney', 'Tatum', 'Dana', 'Elena', 'Fatima', 'Grace', 'Hannah',
  'Ivan', 'Julia', 'Kenji', 'Liam', 'Maya', 'Nina', 'Omar', 'Priya', 'Raj', 'Sofia',
  'Tariq', 'Uma', 'Viktor', 'Wendy', 'Xavier', 'Yuki', 'Zara', 'Adam', 'Beth', 'Carlos',
  'Diana', 'Ethan', 'Fiona', 'George', 'Helen', 'Isaac', 'Jane', 'Kevin', 'Laura', 'Marcus',
]

const LAST_NAMES = [
  'Chen', 'Patel', 'Kim', 'Nguyen', 'Garcia', 'Martinez', 'Johnson', 'Williams', 'Brown', 'Jones',
  'Miller', 'Davis', 'Rodriguez', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen',
  'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Campbell', 'Mitchell',
  'Roberts', 'Carter', 'Phillips', 'Evans', 'Turner', 'Torres', 'Parker', 'Collins', 'Edwards', 'Stewart',
  'Flores', 'Morris', 'Murphy', 'Rivera', 'Cook', 'Rogers', 'Morgan', 'Peterson', 'Cooper', 'Reed',
]

const COMPANIES = [
  'a16z', 'Sequoia', 'Goldman Sachs', 'McKinsey', 'Google', 'Meta', 'JPMorgan', 'Blackstone',
  'KKR', 'Citadel', 'Bridgewater', 'Stripe', 'OpenAI', 'Tesla', 'Apple', 'Microsoft',
  'Bloomberg', 'Reuters', 'NYT', 'WSJ', 'Harvard', 'Stanford', 'Yale', 'Columbia',
]

const TITLES = [
  'Partner', 'Managing Director', 'VP', 'Founder', 'CEO', 'Investor', 'Counsel', 'Board member',
  'Principal', 'General Partner', 'Operator', 'Advisor', 'Head of', 'Director',
]

/** Compact adjacency: index → list of neighbor indices (+ special you=-1 handled separately). */
export type MegaGraphState = {
  /** personIds[i] for i in 0..N-1 */
  personIds: string[]
  /** id → index */
  indexOf: Map<string, number>
  /** neighbors[i] = packed neighbor indices */
  neighbors: Int32Array[]
  names: string[]
  knownByYou: Set<string>
  edgeCount: number
  pathCache: Map<string, string[]>
  /** you → known contact indices */
  youNeighbors: number[]
}

let state: MegaGraphState | null = null

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function personId(i: number): string {
  return `person-${i}`
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

function makeEdge(source: string, target: string, strength: number): GraphEdge {
  const [a, b] = source < target ? [source, target] : [target, source]
  return {
    id: `e-${a}-${b}`,
    source,
    target,
    type: 'partner',
    strength,
    recency: '2024-06-15',
    explanation: 'Inferred from public overlap and contact graph.',
    evidence: [
      {
        title: 'Synthetic demo edge',
        url: '#demo',
        snippet: 'Illustrative connection for demo network.',
        date: '2024-06-15',
        quality: 'directory',
      },
    ],
  }
}

export function generateMegaGraph(seed = 42): MegaGraphState {
  const rng = mulberry32(seed)
  const n = MEGA_GRAPH_PEOPLE
  const personIds: string[] = new Array(n)
  personIds[0] = MEGA_JAY_ID
  for (let i = 1; i < n - 1; i++) personIds[i] = personId(i - 1)
  personIds[n - 1] = MEGA_TRUMP_ID

  const indexOf = new Map<string, number>()
  for (let i = 0; i < n; i++) indexOf.set(personIds[i], i)

  const names: string[] = new Array(n)
  names[0] = 'Jay Neveloff'
  names[n - 1] = 'Donald Trump'
  for (let i = 1; i < n - 1; i++) {
    names[i] =
      `${FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]}`
  }

  // Build undirected edges as sets of neighbor indices, then freeze to Int32Array.
  const buckets: number[][] = Array.from({ length: n }, () => [])
  const seen = new Set<string>()
  let edgeCount = 0

  const link = (a: number, b: number) => {
    if (a === b) return
    const key = a < b ? `${a}|${b}` : `${b}|${a}`
    if (seen.has(key)) return
    seen.add(key)
    buckets[a].push(b)
    buckets[b].push(a)
    edgeCount++
  }

  // Ring backbone — everyone reachable.
  for (let i = 0; i < n; i++) link(i, (i + 1) % n)

  // Small-world shortcuts.
  const shortcuts = Math.floor(n * 0.9)
  for (let i = 0; i < shortcuts; i++) {
    link(Math.floor(rng() * n), Math.floor(rng() * n))
  }

  // Local clusters.
  for (let i = 0; i < n; i += 40) {
    for (let j = 1; j <= 3; j++) link(i, (i + j) % n)
  }

  // Jay ↔ mid ↔ Trump bridge.
  const mid = Math.floor((0 + (n - 1)) / 2)
  link(0, mid)
  link(mid, n - 1)

  const knownByYou = new Set<string>([MEGA_JAY_ID])
  const youNeighbors: number[] = [0]
  for (let i = 0; i < MEGA_YOUR_CONTACTS; i++) {
    const idx = i + 1 // person-0 .. skip Jay at 0
    if (idx >= n - 1) break
    knownByYou.add(personIds[idx])
    youNeighbors.push(idx)
  }

  const neighbors = buckets.map((b) => Int32Array.from(b))

  return {
    personIds,
    indexOf,
    neighbors,
    names,
    knownByYou,
    edgeCount: edgeCount + youNeighbors.length,
    pathCache: new Map(),
    youNeighbors,
  }
}

export function ensureMegaGraph(): MegaGraphState {
  if (!state) state = generateMegaGraph()
  return state
}

export function resetMegaGraph(): void {
  state = null
}

export function getMegaStats() {
  const g = ensureMegaGraph()
  return {
    people: MEGA_GRAPH_PEOPLE,
    edges: g.edgeCount,
    yourContacts: g.knownByYou.size,
  }
}

export function getMegaKnownIds(): string[] {
  return [...ensureMegaGraph().knownByYou]
}

export function getMegaPersonIds(): string[] {
  return ensureMegaGraph().personIds
}

export function getMegaNode(id: string): GraphNode | undefined {
  const g = ensureMegaGraph()
  if (id === 'you') return undefined
  const idx = g.indexOf.get(id)
  if (idx === undefined) return undefined
  const name = g.names[idx]
  const isJay = id === MEGA_JAY_ID
  const isTrump = id === MEGA_TRUMP_ID
  const known = g.knownByYou.has(id)

  return {
    id,
    name,
    type: 'person',
    summary: isTrump
      ? 'Former U.S. President. High-profile target at the far end of the demo network.'
      : isJay
        ? 'Major NYC real estate attorney. Your strongest warm bridge in this 50k-person demo.'
        : `${TITLES[Math.abs(hashCode(id)) % TITLES.length]} · ${COMPANIES[Math.abs(hashCode(id + 'c')) % COMPANIES.length]}`,
    tags: isJay || isTrump ? ['bridge person', 'power broker'] : [],
    knownByUser: known,
    warmth: known ? (isJay ? 0.88 : 0.72) : undefined,
    timeline: [{ date: '2024', label: 'In synthetic demo network' }],
  }
}

function edgeBetween(fromId: string, toId: string, strength = 0.65): GraphEdge {
  return makeEdge(fromId, toId, strength)
}

export function getMegaNeighbors(
  id: string,
  minStrength: number,
): { nodeId: string; edge: GraphEdge }[] {
  const g = ensureMegaGraph()
  if (minStrength > 0.9) return []

  if (id === 'you') {
    return g.youNeighbors.map((idx) => {
      const nodeId = g.personIds[idx]
      const strength = nodeId === MEGA_JAY_ID ? 0.88 : 0.82
      return { nodeId, edge: edgeBetween('you', nodeId, strength) }
    })
  }

  const idx = g.indexOf.get(id)
  if (idx === undefined) return []
  const out: { nodeId: string; edge: GraphEdge }[] = []
  for (const nIdx of g.neighbors[idx]) {
    const nodeId = g.personIds[nIdx]
    out.push({ nodeId, edge: edgeBetween(id, nodeId, 0.62) })
  }
  // Include you if this person is a known contact.
  if (g.knownByYou.has(id)) {
    out.push({
      nodeId: 'you',
      edge: edgeBetween(id, 'you', id === MEGA_JAY_ID ? 0.88 : 0.82),
    })
  }
  return out
}

export function getMegaEdgesForNodes(ids: Set<string>): GraphEdge[] {
  const seen = new Set<string>()
  const edges: GraphEdge[] = []
  for (const id of ids) {
    for (const { nodeId, edge } of getMegaNeighbors(id, 0.15)) {
      if (!ids.has(nodeId)) continue
      if (seen.has(edge.id)) continue
      seen.add(edge.id)
      edges.push(edge)
    }
  }
  return edges
}

export function getMegaShortestPath(fromId: string, targetId: string): string[] | null {
  if (fromId === targetId) return [fromId]
  const g = ensureMegaGraph()
  const cacheKey = `${fromId}->${targetId}`
  const cached = g.pathCache.get(cacheKey)
  if (cached) return cached

  // BFS over indices; you is virtual node -1.
  const YOU = -1
  const fromIdx = fromId === 'you' ? YOU : g.indexOf.get(fromId)
  const targetIdx = targetId === 'you' ? YOU : g.indexOf.get(targetId)
  if (fromIdx === undefined || targetIdx === undefined) return null

  const queue: number[] = [fromIdx]
  const prev = new Map<number, number | null>([[fromIdx, null]])

  const neighborsOf = (idx: number): number[] => {
    if (idx === YOU) return g.youNeighbors
    const list = [...g.neighbors[idx]]
    if (g.knownByYou.has(g.personIds[idx])) list.push(YOU)
    return list
  }

  while (queue.length) {
    const current = queue.shift()!
    if (current === targetIdx) break
    for (const next of neighborsOf(current)) {
      if (prev.has(next)) continue
      prev.set(next, current)
      queue.push(next)
    }
  }

  if (!prev.has(targetIdx)) return null

  const pathIdx: number[] = []
  let cur: number | null = targetIdx
  while (cur !== null) {
    pathIdx.unshift(cur)
    cur = prev.get(cur) ?? null
  }

  const path = pathIdx.map((i) => (i === YOU ? 'you' : g.personIds[i]))
  g.pathCache.set(cacheKey, path)
  return path
}

export function searchMegaNodes(query: string, limit = 20): GraphNode[] {
  const g = ensureMegaGraph()
  const q = query.trim().toLowerCase()
  const results: GraphNode[] = []

  const pushId = (id: string) => {
    if (results.length >= limit) return
    if (results.some((r) => r.id === id)) return
    const node = getMegaNode(id)
    if (node) results.push(node)
  }

  if (!q) {
    pushId(MEGA_TRUMP_ID)
    pushId(MEGA_JAY_ID)
    for (let i = 1; i < Math.min(g.personIds.length, limit + 2); i++) pushId(g.personIds[i])
    return results.slice(0, limit)
  }

  for (const special of [MEGA_TRUMP_ID, MEGA_JAY_ID]) {
    if (g.names[g.indexOf.get(special)!].toLowerCase().includes(q)) pushId(special)
  }

  for (let i = 0; i < g.names.length && results.length < limit; i++) {
    if (g.names[i].toLowerCase().includes(q)) pushId(g.personIds[i])
  }
  return results
}

export function getMegaVisibleNodes(pathIds: string[] = []): GraphNode[] {
  const g = ensureMegaGraph()
  const ids = new Set<string>([...g.knownByYou])
  for (const id of pathIds) {
    if (id !== 'you') ids.add(id)
  }
  for (const id of pathIds) {
    if (id === 'you') continue
    const idx = g.indexOf.get(id)
    if (idx === undefined) continue
    for (const nIdx of g.neighbors[idx]) {
      ids.add(g.personIds[nIdx])
      if (ids.size > 180) break
    }
  }
  return [...ids]
    .slice(0, 200)
    .map((id) => getMegaNode(id))
    .filter((n): n is GraphNode => !!n)
}
