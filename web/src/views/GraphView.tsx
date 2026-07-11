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
import { findPaths, getEdgesForNode, getNode, otherEnd } from '../data/paths'
import type { GraphEdge, GraphNode } from '../data/types'
import { Shell } from '../components/Shell'
import { useGraph } from '../context/GraphContext'
import { usePreferences } from '../context/PreferencesContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

type SimNode = GraphNode & SimulationNodeDatum
type SimLink = { source: string | SimNode; target: string | SimNode; edge: GraphEdge }

const WEAK_THRESHOLD = 0.35
const YOU_ID = getYouId()

function nodeFill(n: GraphNode): string {
  if (n.id === YOU_ID) return 'var(--you)'
  if (n.type === 'person') return '#b8c4d4'
  if (n.type === 'company') return '#8fa3b8'
  return '#9a8f7a'
}

function nodeRadius(n: GraphNode): number {
  if (n.id === YOU_ID) return 14
  if (n.type === 'person') return n.knownByUser ? 11 : 9
  return 7
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
  const { nodes, edges, version } = useGraph()
  const { version: prefVersion } = usePreferences()
  const [params, setParams] = useSearchParams()
  const focusId = params.get('focus') ?? YOU_ID
  const [selectedId, setSelectedId] = useState(focusId)
  const [hideWeak, setHideWeak] = useState(true)
  const [fitTick, setFitTick] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const nodesRef = useRef<SimNode[]>([])
  const zoomRef = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(null)

  useEffect(() => {
    setSelectedId(focusId)
  }, [focusId])

  const filteredEdges = useMemo(() => {
    void version
    void prefVersion
    return edges.filter((e) => {
      if (e.type === 'weak public mention' && hideWeak) return false
      if (hideWeak && e.strength < WEAK_THRESHOLD) return false
      return true
    })
  }, [edges, hideWeak, version, prefVersion])

  const activeNodeIds = useMemo(() => {
    const ids = new Set<string>()
    filteredEdges.forEach((e) => {
      ids.add(e.source)
      ids.add(e.target)
    })
    ids.add(YOU_ID)
    ids.add(selectedId)
    return ids
  }, [filteredEdges, selectedId])

  const graphNodes = useMemo(
    () => nodes.filter((n) => activeNodeIds.has(n.id)),
    [nodes, activeNodeIds],
  )

  const selected = getNode(selectedId)
  const selectedEdges = selected
    ? getEdgesForNode(selected.id).filter((e) => !hideWeak || e.strength >= WEAK_THRESHOLD)
    : []

  useDocumentTitle('Graph')

  const { pathNodeIds, pathEdgeIds } = useMemo(() => {
    void version
    const empty = { pathNodeIds: new Set<string>(), pathEdgeIds: new Set<string>() }
    if (selectedId === YOU_ID) return empty
    const paths = findPaths(selectedId, {
      maxDepth: 5,
      maxPaths: 3,
      minStrength: hideWeak ? WEAK_THRESHOLD : 0.15,
    })
    if (!paths.length) return empty
    return {
      pathNodeIds: new Set(paths[0].nodeIds),
      pathEdgeIds: new Set(paths[0].hops.map((h) => h.edge.id)),
    }
  }, [selectedId, hideWeak, version])

  useEffect(() => {
    const svgEl = svgRef.current
    const gEl = gRef.current
    if (!svgEl || !gEl) return

    const width = svgEl.clientWidth || 800
    const height = svgEl.clientHeight || 600

    const simNodes: SimNode[] = graphNodes.map((n) => ({ ...n }))
    nodesRef.current = simNodes
    const simLinks: SimLink[] = filteredEdges
      .filter((e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, edge: e }))

    const simulation = forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((l) => 80 + (1 - l.edge.strength) * 60)
          .strength((l) => 0.2 + l.edge.strength * 0.5),
      )
      .force('charge', forceManyBody().strength(-220))
      .force('center', forceCenter(width / 2, height / 2))
      .force(
        'collide',
        forceCollide<SimNode>().radius((d) => nodeRadius(d) + 8),
      )

    const g = select(gEl)
    g.selectAll('*').remove()

    const link = g
      .append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', (d) => {
        if (pathEdgeIds.has(d.edge.id)) return '#c4a35a'
        return d.edge.strength < WEAK_THRESHOLD
          ? '#3d4455'
          : `rgba(154, 149, 140, ${0.25 + d.edge.strength * 0.55})`
      })
      .attr('stroke-width', (d) =>
        pathEdgeIds.has(d.edge.id)
          ? Math.max(2.5, d.edge.strength * 5)
          : Math.max(0.6, d.edge.strength * 4.5),
      )
      .attr('stroke-opacity', (d) => {
        if (!pathEdgeIds.size) return d.edge.strength < WEAK_THRESHOLD ? 0.35 : 0.75
        return pathEdgeIds.has(d.edge.id) ? 0.95 : 0.12
      })

    const nodeG = g
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
      .attr('stroke', (d) => (d.id === selectedId ? '#c4a35a' : 'transparent'))
      .attr('stroke-width', 2.5)
      .attr('opacity', (d) => {
        if (!pathNodeIds.size) return 1
        return pathNodeIds.has(d.id) || d.id === selectedId ? 1 : 0.2
      })
      .attr('class', (d) => (d.id === YOU_ID ? 'node-you' : ''))

    nodeG
      .append('text')
      .text((d) => d.name)
      .attr('x', (d) => nodeRadius(d) + 4)
      .attr('y', 3)
      .attr('fill', '#e8e6e3')
      .attr('font-size', 10)
      .attr('font-family', 'IBM Plex Sans, sans-serif')
      .attr('opacity', (d) => {
        if (!pathNodeIds.size) return 0.85
        return pathNodeIds.has(d.id) || d.id === selectedId ? 0.95 : 0.15
      })

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
  }, [graphNodes, filteredEdges, activeNodeIds, selectedId, pathNodeIds, pathEdgeIds, navigate, setParams])

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
      <div className="graph-layout" id="main">
        <div className="graph-canvas-wrap">
          <div className="graph-toolbar">
            <button
              type="button"
              className={`chip ${hideWeak ? 'on' : ''}`}
              onClick={() => setHideWeak((v) => !v)}
            >
              {hideWeak ? 'Strong links only' : 'Show weak links'}
            </button>
            <button type="button" className="chip" onClick={() => setFitTick((n) => n + 1)}>
              Fit
            </button>
          </div>
          <svg ref={svgRef} role="img" aria-label="Relationship graph">
            <g ref={gRef} />
          </svg>
          <div className="graph-hint">Scroll to zoom · click a node · double-click for note</div>
        </div>
        <aside className="side-panel">
          {selected ? (
            <>
              <div>
                <div className="panel-label">Selected</div>
                <h2 className="panel-title">{selected.name}</h2>
                <div className="panel-type">{NODE_TYPE_LABEL[selected.type]}</div>
                <p className="panel-body">{selected.summary}</p>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '1rem' }}
                  onClick={() => navigate(`/person/${selected.id}`)}
                >
                  Open
                </button>
                {selected.type === 'person' && selected.id !== YOU_ID && (
                  <button
                    type="button"
                    className="chip"
                    style={{ marginTop: '0.5rem', width: '100%' }}
                    onClick={() => navigate(`/?to=${selected.id}`)}
                  >
                    Find path here
                  </button>
                )}
              </div>
              <div>
                <div className="panel-label">Connected to</div>
                <div className="edge-list">
                  {selectedEdges.length === 0 && (
                    <p className="panel-body">No connections at this filter.</p>
                  )}
                  {selectedEdges.map((edge) => {
                    const other = getNode(otherEnd(edge, selected.id))
                    if (!other) return null
                    const evidence = edge.evidence[0]
                    return (
                      <div
                        key={edge.id}
                        className={`edge-card ${edge.strength < WEAK_THRESHOLD ? 'weak' : ''}`}
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
                        <div className="etype">
                          {edge.type} · {Math.round(edge.strength * 100)}
                        </div>
                        <div className="ename">{other.name}</div>
                        <div className="eevidence">{edge.explanation}</div>
                        {evidence && (
                          <div className="eevidence" style={{ marginTop: 4 }}>
                            {evidence.title}
                            {evidence.url.startsWith('#') ? ' · illustrative' : ''}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <p className="panel-body">Click a node</p>
          )}
        </aside>
      </div>
    </Shell>
  )
}
