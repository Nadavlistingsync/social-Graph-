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

type AdjEntry = { to: string; edge: GraphEdge }

export type MegaGraphState = {
  personIds: string[]
  adjacency: Map<string, AdjEntry[]>
  names: Map<string, string>
  knownByYou: Set<string>
  edgeCount: number
  pathCache: Map<string, string[]>
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

function makeEdge(source: string, target: string, strength: number, type: GraphEdge['type'] = 'partner'): GraphEdge {
  const [a, b] = source < target ? [source, target] : [target, source]
  return {
    id: `e-${a}-${b}`,
    source,
    target,
    type,
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

function addEdge(
  adj: Map<string, AdjEntry[]>,
  edgeKeys: Set<string>,
  source: string,
  target: string,
  strength: number,
) {
  if (source === target) return false
  const [a, b] = source < target ? [source, target] : [target, source]
  const key = `${a}|${b}`
  if (edgeKeys.has(key)) return false
  edgeKeys.add(key)
  const edge = makeEdge(source, target, strength)
  const listA = adj.get(source) ?? []
  listA.push({ to: target, edge })
  adj.set(source, listA)
  const listB = adj.get(target) ?? []
  listB.push({ to: source, edge: { ...edge, source: target, target: source } })
  adj.set(target, listB)
  return true
}

function personId(i: number): string {
  return `person-${i}`
}

function buildNames(rng: () => number): Map<string, string> {
  const names = new Map<string, string>()
  names.set(MEGA_JAY_ID, 'Jay Neveloff')
  names.set(MEGA_TRUMP_ID, 'Donald Trump')

  for (let i = 0; i < MEGA_GRAPH_PEOPLE - 2; i++) {
    const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]
    const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]
    names.set(personId(i), `${first} ${last}`)
  }
  return names
}

export function generateMegaGraph(seed = 42): MegaGraphState {
  const rng = mulberry32(seed)
  const personIds: string[] = [MEGA_JAY_ID]
  for (let i = 0; i < MEGA_GRAPH_PEOPLE - 2; i++) personIds.push(personId(i))
  personIds.push(MEGA_TRUMP_ID)

  const names = buildNames(rng)
  const adjacency = new Map<string, AdjEntry[]>()
  const edgeKeys = new Set<string>()
  let edgeCount = 0

  for (let i = 0; i < personIds.length; i++) {
    const a = personIds[i]
    const b = personIds[(i + 1) % personIds.length]
    if (addEdge(adjacency, edgeKeys, a, b, 0.55 + rng() * 0.2)) edgeCount++
  }

  const shortcuts = Math.floor(personIds.length * 1.1)
  for (let i = 0; i < shortcuts; i++) {
    const a = personIds[Math.floor(rng() * personIds.length)]
    const b = personIds[Math.floor(rng() * personIds.length)]
    if (addEdge(adjacency, edgeKeys, a, b, 0.45 + rng() * 0.35)) edgeCount++
  }

  for (let i = 0; i < personIds.length; i += 37) {
    for (let j = 1; j <= 4; j++) {
      const a = personIds[i]
      const b = personIds[(i + j) % personIds.length]
      if (addEdge(adjacency, edgeKeys, a, b, 0.6 + rng() * 0.25)) edgeCount++
    }
  }

  const knownByYou = new Set<string>([MEGA_JAY_ID])
  for (let i = 0; i < MEGA_YOUR_CONTACTS; i++) {
    knownByYou.add(personId(i))
  }

  for (const id of knownByYou) {
    if (addEdge(adjacency, edgeKeys, 'you', id, 0.82 + rng() * 0.12)) edgeCount++
  }

  const trumpIndex = personIds.indexOf(MEGA_TRUMP_ID)
  const jayIndex = personIds.indexOf(MEGA_JAY_ID)
  const mid = personIds[Math.floor((trumpIndex + jayIndex) / 2)]
  if (addEdge(adjacency, edgeKeys, MEGA_JAY_ID, mid, 0.78)) edgeCount++
  if (addEdge(adjacency, edgeKeys, mid, MEGA_TRUMP_ID, 0.72)) edgeCount++

  return {
    personIds,
    adjacency,
    names,
    knownByYou,
    edgeCount,
    pathCache: new Map(),
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

function hashCode(n: number | string): number {
  const s = String(n)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

export function getMegaNode(id: string): GraphNode | undefined {
  const g = ensureMegaGraph()
  if (id === 'you') return undefined
  const name = g.names.get(id)
  if (!name) return undefined

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

export function getMegaNeighbors(
  id: string,
  minStrength: number,
): { nodeId: string; edge: GraphEdge }[] {
  const g = ensureMegaGraph()
  const list = g.adjacency.get(id) ?? []
  return list.filter((e) => e.edge.strength >= minStrength).map((e) => ({ nodeId: e.to, edge: e.edge }))
}

export function getMegaEdgesForNodes(ids: Set<string>): GraphEdge[] {
  const g = ensureMegaGraph()
  const seen = new Set<string>()
  const edges: GraphEdge[] = []
  for (const id of ids) {
    for (const { to, edge } of g.adjacency.get(id) ?? []) {
      if (!ids.has(to)) continue
      const key = edge.id
      if (seen.has(key)) continue
      seen.add(key)
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

  const queue: string[] = [fromId]
  const prev = new Map<string, string | null>([[fromId, null]])

  while (queue.length) {
    const current = queue.shift()!
    if (current === targetId) break
    for (const { to } of g.adjacency.get(current) ?? []) {
      if (prev.has(to)) continue
      prev.set(to, current)
      queue.push(to)
    }
  }

  if (!prev.has(targetId)) return null

  const path: string[] = []
  let cur: string | null = targetId
  while (cur) {
    path.unshift(cur)
    cur = prev.get(cur) ?? null
  }

  g.pathCache.set(cacheKey, path)
  return path
}

export function searchMegaNodes(query: string, limit = 20): GraphNode[] {
  const g = ensureMegaGraph()
  const q = query.trim().toLowerCase()
  if (!q) {
    return [MEGA_TRUMP_ID, MEGA_JAY_ID, ...g.personIds.slice(0, limit - 2)]
      .map((id) => getMegaNode(id))
      .filter((n): n is GraphNode => !!n)
  }

  const results: GraphNode[] = []
  for (const special of [MEGA_TRUMP_ID, MEGA_JAY_ID]) {
    const n = getMegaNode(special)
    if (n && n.name.toLowerCase().includes(q)) results.push(n)
  }

  for (const id of g.personIds) {
    if (results.length >= limit) break
    const name = g.names.get(id) ?? ''
    if (name.toLowerCase().includes(q)) {
      const node = getMegaNode(id)
      if (node) results.push(node)
    }
  }
  return results.slice(0, limit)
}

export function getMegaVisibleNodes(pathIds: string[] = []): GraphNode[] {
  const g = ensureMegaGraph()
  const ids = new Set<string>([...g.knownByYou])
  for (const id of pathIds) ids.add(id)
  for (const id of pathIds) {
    for (const { to } of g.adjacency.get(id) ?? []) {
      ids.add(to)
      if (ids.size > 180) break
    }
  }
  return [...ids]
    .slice(0, 200)
    .map((id) => getMegaNode(id))
    .filter((n): n is GraphNode => !!n)
}
