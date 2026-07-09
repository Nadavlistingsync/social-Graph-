export type NodeType =
  | 'person'
  | 'company'
  | 'property'
  | 'deal'
  | 'article'
  | 'donation'
  | 'board_seat'
  | 'podcast'
  | 'lawsuit'
  | 'investment'
  | 'shared_entity'

export type EdgeType =
  | 'co-founder'
  | 'investor'
  | 'family'
  | 'board member'
  | 'donor'
  | 'lawyer'
  | 'tenant'
  | 'lender'
  | 'podcast guest'
  | 'political ally'
  | 'partner'
  | 'competitor'
  | 'weak public mention'

export type StrategyTag =
  | 'podcast target'
  | 'sponsor target'
  | 'investor'
  | 'real estate operator'
  | 'family office'
  | 'bridge person'
  | 'power broker'

export type EvidenceQuality = 'primary' | 'news' | 'directory' | 'weak'

export interface Evidence {
  title: string
  url: string
  snippet: string
  date: string
  quality: EvidenceQuality
}

export interface GraphNode {
  id: string
  name: string
  type: NodeType
  summary: string
  tags: StrategyTag[]
  knownByUser?: boolean
  warmth?: number
  timeline: { date: string; label: string }[]
  privateNotes?: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: EdgeType
  strength: number
  recency: string
  evidence: Evidence[]
  explanation: string
}

export interface PathHop {
  fromId: string
  toId: string
  edge: GraphEdge
}

export interface RankedPath {
  id: string
  hops: PathHop[]
  nodeIds: string[]
  scores: {
    warmth: number
    strength: number
    credibility: number
    recency: number
    usefulness: number
    total: number
  }
  firstHopId: string
  rationale: string
}
