import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from 'd3-force'
import { select } from 'd3-selection'
import { drag } from 'd3-drag'
import { zoom, zoomIdentity } from 'd3-zoom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { NODE_TYPE_LABEL } from '../data/seed'
import { getYouId, getNodes as loadNodes, getEdges as loadEdges } from '../data/graphStore'
import { getMegaShortestPath, getMegaNeighbors } from '../data/megaGraph'
import { DEMO_BRIDGE_ID, DEMO_EXTENDED_EVENT, DEMO_STEP_EVENT, DEMO_TARGET_ID, getDemoShowcasePath, getDemoSpotlightIds, getDemoStep, isDemoMode } from '../data/demoMode'
import { getEdgesForNode, getNode, otherEnd } from '../data/paths'
import type { GraphEdge, GraphNode } from '../data/types'
import { Shell } from '../components/Shell'
import { useGraph } from '../context/GraphContext'
import { usePreferences } from '../context/PreferencesContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

type SimNode = GraphNode & SimulationNodeDatum
type SimLink = { source: string | SimNode; target: string | SimNode; edge: GraphEdge }
type Layer = 'mine' | 'extended'

const WEAK_THRESHOLD = 0.35
const YOU_ID = getYouId()

function nodeFill(n: GraphNode): string {
  const effective = getNode(n.id) ?? n
  if (n.id === YOU_ID) return '#0a6b52'
  if (effective.type === 'person') return effective.knownByUser ? '#2f3b4d' : '#7a8799'
  if (effective.type === 'company') return '#5a6b80'
  return '#8a8278'
}

function nodeRadius(n: GraphNode): number {
  const effective = getNode(n.id) ?? n
  if (n.id === YOU_ID) return 16
  if (effective.type === 'person') return effective.knownByUser ? 12 : 9
  return 7
}

function neighborsOf(id: string, edges: GraphEdge[]): Set<string> {
  const out = new Set<string>()
  for (const e of edges) {
    if (e.source === id) out.add(e.target)
    if (e.target === id) out.add(e.source)
  }
  return out
}

function fitToNodes(
  svgEl: SVGSVGElement,
  zoomBehavior: ReturnType<typeof zoom<SVGSVGElement, unknown>>,
  simNodes: SimNode[],
  pad = 48,
) {
  if (!simNodes.length) return
  const width = svgEl.clientWidth || 800
  const height = svgEl.clientHeight || 600
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const n of simNodes) {
    const x = n.x ?? 0
    const y = n.y ?? 0
    const r = nodeRadius(n) + 40
    minX = Math.min(minX, x - r)
    maxX = Math.max(maxX, x + r)
    minY = Math.min(minY, y - r)
    maxY = Math.max(maxY, y + r)
  }
  const bw = Math.max(maxX - minX, 1)
  const bh = Math.max(maxY - minY, 1)
  const scale = Math.min(
    2.2,
    Math.max(0.35, Math.min((width - pad * 2) / bw, (height - pad * 2) / bh)),
  )
  const tx = width / 2 - scale * ((minX + maxX) / 2)
  const ty = height / 2 - scale * ((minY + maxY) / 2)
  select(svgEl).call(
    zoomBehavior.transform as never,
    zoomIdentity.translate(tx, ty).scale(scale),
  )
}

export function GraphView() {
  const navigate = useNavigate()
  const { version, youId, enrichNetwork, isMegaSample, networkStats } = useGraph()
  const { version: prefVersion, getWarmth } = usePreferences()
  const [params, setParams] = useSearchParams()
  const focusId = params.get('focus') ?? YOU_ID
  const pathTarget = params.get('path') ?? (focusId !== YOU_ID ? focusId : null)

  const pathIds = useMemo(() => {
    void version
    if (!isMegaSample || !pathTarget) return []
    return getMegaShortestPath(YOU_ID, pathTarget) ?? []
  }, [isMegaSample, pathTarget, version])

  const nodes = useMemo(() => {
    void version
    return loadNodes(pathIds)
  }, [pathIds, version])

  const edges = useMemo(() => {
    void version
    return loadEdges(pathIds)
  }, [pathIds, version])
  const [selectedId, setSelectedId] = useState(focusId)
  const [layer, setLayer] = useState<Layer>('mine')
  const [fitTick, setFitTick] = useState(0)
  const [enrichBusy, setEnrichBusy] = useState(false)
  const [enrichNote, setEnrichNote] = useState('')
  const [demoStep, setDemoStep] = useState(() => getDemoStep())
  const inDemo = isDemoMode()
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const nodesRef = useRef<SimNode[]>([])
  const zoomRef = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(null)

  useDocumentTitle('Network')

  useEffect(() => {
    setSelectedId(focusId)
  }, [focusId])

  useEffect(() => {
    const onExtended = () => setLayer('extended')
    window.addEventListener(DEMO_EXTENDED_EVENT, onExtended)
    return () => window.removeEventListener(DEMO_EXTENDED_EVENT, onExtended)
  }, [])

  useEffect(() => {
    const sync = () => setDemoStep(getDemoStep())
    window.addEventListener(DEMO_STEP_EVENT, sync)
    return () => window.removeEventListener(DEMO_STEP_EVENT, sync)
  }, [])

  const demoPath = useMemo(() => {
    void version
    void prefVersion
    return inDemo ? getDemoShowcasePath() : null
  }, [inDemo, version, prefVersion])

  const spotlightIds = useMemo(
    () => (inDemo ? getDemoSpotlightIds(demoStep) : new Set<string>()),
    [inDemo, demoStep],
  )

  const pathEdgeIds = useMemo(() => {
    if (isMegaSample && pathIds.length > 1) {
      const ids = new Set<string>()
      for (let i = 0; i < pathIds.length - 1; i++) {
        const hop = getMegaNeighbors(pathIds[i], 0.15).find((n) => n.nodeId === pathIds[i + 1])
        if (hop) ids.add(hop.edge.id)
      }
      return ids
    }
    if (inDemo && demoPath && demoStep >= 3) {
      return new Set(demoPath.hops.map((h) => h.edge.id))
    }
    return new Set<string>()
  }, [isMegaSample, pathIds, inDemo, demoPath, demoStep])

  useEffect(() => {
    if (!inDemo) return
    if (demoStep === 2) {
      setLayer('mine')
      setSelectedId(DEMO_BRIDGE_ID)
      setParams({ focus: DEMO_BRIDGE_ID })
    }
    if (demoStep === 3) setLayer('extended')
    if (demoStep >= 4) {
      setLayer('extended')
      setSelectedId(DEMO_TARGET_ID)
      setParams({ focus: DEMO_TARGET_ID })
    }
    setFitTick((n) => n + 1)
  }, [inDemo, demoStep, setParams])

  const strongEdges = useMemo(() => {
    void version
    void prefVersion
    return edges.filter((e) => e.type !== 'weak public mention' && e.strength >= WEAK_THRESHOLD)
  }, [edges, version, prefVersion])

  const myPeople = useMemo(() => {
    void version
    void prefVersion
    const direct = neighborsOf(YOU_ID, strongEdges)
    // Also treat warmth “I know them” as first-degree even without an edge yet
    for (const n of nodes) {
      if (n.id === YOU_ID || n.type !== 'person') continue
      const w = getWarmth(n)
      if (w.knownByUser) direct.add(n.id)
    }
    return direct
  }, [strongEdges, nodes, version, prefVersion, getWarmth])

  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>([YOU_ID])
    for (const id of myPeople) ids.add(id)
    if (layer === 'extended') {
      for (const id of myPeople) {
        for (const n2 of neighborsOf(id, strongEdges)) {
          if (n2 !== YOU_ID) ids.add(n2)
        }
      }
    }
    if (inDemo && demoPath && demoStep >= 3) {
      for (const id of demoPath.nodeIds) ids.add(id)
    }
    if (isMegaSample && pathIds.length) {
      for (const id of pathIds) ids.add(id)
    }
    ids.add(selectedId)
    return ids
  }, [myPeople, strongEdges, layer, selectedId, inDemo, demoPath, demoStep])

  const filteredEdges = useMemo(() => {
    return strongEdges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
    )
  }, [strongEdges, visibleNodeIds])

  const graphNodes = useMemo(
    () => nodes.filter((n) => visibleNodeIds.has(n.id)),
    [nodes, visibleNodeIds],
  )

  const selected = getNode(selectedId)
  const selectedEdges = useMemo(() => {
    void version
    if (!selected) return []
    const ids = new Set(filteredEdges.map((e) => e.id))
    return getEdgesForNode(selected.id).filter((e) => ids.has(e.id))
  }, [selected, filteredEdges, version])

  useEffect(() => {
    const svgEl = svgRef.current
    const gEl = gRef.current
    if (!svgEl || !gEl) return

    const width = svgEl.clientWidth || 800
    const height = svgEl.clientHeight || 600
    const simNodes: SimNode[] = graphNodes.map((n) => ({ ...n }))
    nodesRef.current = simNodes
    const simLinks: SimLink[] = filteredEdges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      edge,
    }))

    select(gEl).selectAll('*').remove()

    const simulation = forceSimulation(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((d) => (d.edge.strength > 0.7 ? 70 : 110))
          .strength(0.55),
      )
      .force('charge', forceManyBody().strength(-220))
      .force('center', forceCenter(width / 2, height / 2))
      .force(
        'collide',
        forceCollide<SimNode>().radius((d) => nodeRadius(d) + 10),
      )

    const link = select(gEl)
      .append('g')
      .attr('stroke-linecap', 'round')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', (d) => {
        if (pathEdgeIds.has(d.edge.id)) return '#0a6b52'
        if (d.edge.source === YOU_ID || d.edge.target === YOU_ID) return '#0a6b52'
        return `rgba(47, 59, 77, ${0.2 + d.edge.strength * 0.45})`
      })
      .attr('stroke-width', (d) => {
        if (pathEdgeIds.has(d.edge.id)) return 4
        return d.edge.source === YOU_ID || d.edge.target === YOU_ID ? 2.2 : 1.4
      })
      .attr('class', (d) => (pathEdgeIds.has(d.edge.id) ? 'demo-path-edge' : ''))

    const nodeG = select(gEl)
      .append('g')
      .selectAll('g')
      .data(simNodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.25).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          }) as never,
      )

    nodeG
      .append('circle')
      .attr('r', (d) => nodeRadius(d))
      .attr('fill', (d) => nodeFill(d))
      .attr('stroke', (d) => {
        if (spotlightIds.has(d.id)) return '#0a6b52'
        return d.id === selectedId ? '#0a6b52' : 'transparent'
      })
      .attr('stroke-width', (d) => (spotlightIds.has(d.id) ? 4 : 3))
      .attr('class', (d) => {
        const classes = [d.id === youId ? 'node-you' : '']
        if (spotlightIds.has(d.id)) classes.push('demo-spotlight-node')
        return classes.filter(Boolean).join(' ')
      })

    nodeG
      .filter((d) => spotlightIds.has(d.id))
      .append('circle')
      .attr('class', 'demo-spotlight-ring')
      .attr('r', (d) => nodeRadius(d) + 12)
      .attr('fill', 'none')
      .attr('stroke', '#0a6b52')
      .attr('stroke-width', 2)
      .attr('opacity', 0.45)

    nodeG
      .append('text')
      .text((d) => d.name)
      .attr('x', (d) => nodeRadius(d) + 5)
      .attr('y', 4)
      .attr('fill', '#12161f')
      .attr('font-size', 12)
      .attr('font-family', 'Figtree, sans-serif')
      .attr('font-weight', 500)

    nodeG.on('click', (event, d) => {
      event.stopPropagation()
      setSelectedId(d.id)
      setParams({ focus: d.id })
    })

    nodeG.on('dblclick', (event, d) => {
      event.stopPropagation()
      navigate(`/person/${d.id}`)
    })

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0)
      nodeG.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 3])
      .on('zoom', (event) => {
        select(gEl).attr('transform', event.transform)
      })
    zoomRef.current = zoomBehavior

    select(svgEl).call(zoomBehavior as never)
    select(svgEl).call(zoomBehavior.transform as never, zoomIdentity)

    simulation.on('end', () => {
      const fitNodes =
        inDemo && spotlightIds.size
          ? simNodes.filter((n) => spotlightIds.has(n.id))
          : simNodes
      fitToNodes(svgEl, zoomBehavior, fitNodes.length ? fitNodes : simNodes)
    })

    return () => {
      simulation.stop()
      zoomRef.current = null
    }
  }, [graphNodes, filteredEdges, selectedId, navigate, setParams, youId, spotlightIds, pathEdgeIds, inDemo])

  useEffect(() => {
    if (!fitTick) return
    const svgEl = svgRef.current
    const zoomBehavior = zoomRef.current
    if (!svgEl || !zoomBehavior) return
    fitToNodes(svgEl, zoomBehavior, nodesRef.current)
  }, [fitTick])

  useEffect(() => {
    const onResize = () => setFitTick((n) => n + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  async function handleExpandNetwork(anchorId?: string) {
    setEnrichBusy(true)
    setEnrichNote('')
    const result = await enrichNetwork({ anchorId, useAi: true })
    setEnrichBusy(false)
    if (!result.ok) {
      setEnrichNote(result.error)
      return
    }
    if (result.added > 0) {
      setLayer('extended')
      setEnrichNote(
        `Added ${result.added} likely connection${result.added === 1 ? '' : 's'} — switch to Their network to explore.`,
      )
      setFitTick((n) => n + 1)
    } else {
      setEnrichNote('No new connections found yet. Import more contacts with work emails or companies.')
    }
  }

  return (
    <Shell active="graph">
      <div className="graph-layout" id="main-graph">
        <div className="graph-canvas-wrap">
          <div className="graph-toolbar">
            {isMegaSample && networkStats && (
              <div className="mega-stats-chip" role="status">
                <strong>{networkStats.people.toLocaleString()}</strong> people ·{' '}
                <strong>{networkStats.edges.toLocaleString()}</strong> links · you know{' '}
                <strong>{networkStats.yourContacts}</strong>
              </div>
            )}
            <div className="layer-toggle" role="group" aria-label="Network depth">
              <button
                type="button"
                className={`chip ${layer === 'mine' ? 'on' : ''}`}
                onClick={() => setLayer('mine')}
              >
                My network
              </button>
              <button
                type="button"
                className={`chip ${layer === 'extended' ? 'on' : ''}`}
                onClick={() => setLayer('extended')}
              >
                Their network
              </button>
            </div>
            <button type="button" className="chip" onClick={() => setFitTick((n) => n + 1)}>
              Fit
            </button>
            <button
              type="button"
              className="chip on"
              disabled={enrichBusy || isMegaSample}
              onClick={() => void handleExpandNetwork()}
            >
              {enrichBusy ? 'Expanding…' : isMegaSample ? '50k loaded' : 'Expand network'}
            </button>
          </div>
          {enrichNote && <div className="enrich-toast">{enrichNote}</div>}
          <svg ref={svgRef} role="img" aria-label="Your network map">
            <g ref={gRef} />
          </svg>
          <div className="graph-hint">
            {isMegaSample
              ? pathIds.length > 1
                ? `Path to ${getNode(pathIds.at(-1)!)?.name ?? 'target'} · ${pathIds.length - 1} hops across ${networkStats?.people.toLocaleString()} people`
                : `50,000-person demo · tap someone or use Find to trace a path`
              : layer === 'mine'
                ? 'People you know · pinch to zoom · tap someone'
                : 'People your people know · pinch to zoom · tap someone'}
          </div>
        </div>
        <aside className="side-panel">
          {selected ? (
            <>
              <div>
                <div className="panel-label">
                  {selected.id === YOU_ID
                    ? 'You'
                    : myPeople.has(selected.id)
                      ? 'In your network'
                      : 'In their network'}
                </div>
                <h2 className="panel-title">{selected.name}</h2>
                <div className="panel-type">{NODE_TYPE_LABEL[selected.type]}</div>
                <p className="panel-body">{selected.summary}</p>
                <div className="panel-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => navigate(`/person/${selected.id}`)}
                  >
                    Open
                  </button>
                  {selected.type === 'person' && selected.id !== YOU_ID && (
                    <button
                      type="button"
                      className="btn-quiet"
                      onClick={() => navigate(`/find?to=${selected.id}`)}
                    >
                      Find intro
                    </button>
                  )}
                  {selected.type === 'person' && selected.id !== YOU_ID && (
                    <button
                      type="button"
                      className="btn-quiet"
                      disabled={enrichBusy}
                      onClick={() => void handleExpandNetwork(selected.id)}
                    >
                      {enrichBusy ? 'Expanding…' : 'Their connections'}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <div className="panel-label">Connected to</div>
                <div className="edge-list">
                  {selectedEdges.length === 0 && (
                    <p className="panel-body">No links in this view yet.</p>
                  )}
                  {selectedEdges.map((edge) => {
                    const other = getNode(otherEnd(edge, selected.id))
                    if (!other) return null
                    return (
                      <div
                        key={edge.id}
                        className="edge-card"
                        onClick={() => {
                          setSelectedId(other.id)
                          setParams({ focus: other.id })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setSelectedId(other.id)
                            setParams({ focus: other.id })
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="etype">{edge.type}</div>
                        <div className="ename">{other.name}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <p className="panel-body">Tap someone on the map.</p>
          )}
        </aside>
      </div>
    </Shell>
  )
}
