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
import { getYouId } from '../data/graphStore'
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
  if (n.id === YOU_ID) return '#0a6b52'
  if (n.type === 'person') return n.knownByUser ? '#2f3b4d' : '#7a8799'
  if (n.type === 'company') return '#5a6b80'
  return '#8a8278'
}

function nodeRadius(n: GraphNode): number {
  if (n.id === YOU_ID) return 16
  if (n.type === 'person') return n.knownByUser ? 12 : 9
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
  const { nodes, edges, version, youId } = useGraph()
  const { version: prefVersion, getWarmth } = usePreferences()
  const [params, setParams] = useSearchParams()
  const focusId = params.get('focus') ?? YOU_ID
  const [selectedId, setSelectedId] = useState(focusId)
  const [layer, setLayer] = useState<Layer>('mine')
  const [fitTick, setFitTick] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const nodesRef = useRef<SimNode[]>([])
  const zoomRef = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(null)

  useDocumentTitle('Network')

  useEffect(() => {
    setSelectedId(focusId)
  }, [focusId])

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
    ids.add(selectedId)
    return ids
  }, [myPeople, strongEdges, layer, selectedId])

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
      .attr('stroke', (d) =>
        d.edge.source === YOU_ID || d.edge.target === YOU_ID
          ? '#0a6b52'
          : `rgba(47, 59, 77, ${0.2 + d.edge.strength * 0.45})`,
      )
      .attr('stroke-width', (d) => (d.edge.source === YOU_ID || d.edge.target === YOU_ID ? 2.2 : 1.4))

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
      .attr('stroke', (d) => (d.id === selectedId ? '#0a6b52' : 'transparent'))
      .attr('stroke-width', 3)
      .attr('class', (d) => (d.id === youId ? 'node-you' : ''))

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
      fitToNodes(svgEl, zoomBehavior, simNodes)
    })

    return () => {
      simulation.stop()
      zoomRef.current = null
    }
  }, [graphNodes, filteredEdges, selectedId, navigate, setParams, youId])

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

  return (
    <Shell active="graph">
      <div className="graph-layout" id="main-graph">
        <div className="graph-canvas-wrap">
          <div className="graph-toolbar">
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
          </div>
          <svg ref={svgRef} role="img" aria-label="Your network map">
            <g ref={gRef} />
          </svg>
          <div className="graph-hint">
            {layer === 'mine'
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
