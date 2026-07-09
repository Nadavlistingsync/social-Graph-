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
import { EDGE_TYPES, edges, NODE_TYPE_LABEL, nodes, YOU_ID } from '../data/seed'
import { findPaths, getEdgesForNode, getNode, otherEnd } from '../data/paths'
import type { GraphEdge, GraphNode } from '../data/types'
import { Shell } from '../components/Shell'

type SimNode = GraphNode & SimulationNodeDatum
type SimLink = { source: string | SimNode; target: string | SimNode; edge: GraphEdge }

const WEAK_THRESHOLD = 0.35

function nodeFill(n: GraphNode): string {
  if (n.id === YOU_ID) return 'var(--you)'
  if (n.type === 'person') return '#b8c4d4'
  if (n.type === 'company') return '#8fa3b8'
  if (n.type === 'property' || n.type === 'deal') return '#9a8f7a'
  return '#7a756c'
}

function nodeRadius(n: GraphNode): number {
  if (n.id === YOU_ID) return 14
  if (n.type === 'person') return n.knownByUser ? 11 : 9
  if (n.type === 'company') return 8
  return 6.5
}

export function GraphView() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const focusId = params.get('focus') ?? YOU_ID
  const [selectedId, setSelectedId] = useState(focusId)
  const [hideWeak, setHideWeak] = useState(true)
  const [highlightPath, setHighlightPath] = useState(true)
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(
    () => new Set(EDGE_TYPES.filter((t) => t !== 'weak public mention' || !hideWeak)),
  )
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)

  useEffect(() => {
    setSelectedId(focusId)
  }, [focusId])

  useEffect(() => {
    setEnabledTypes((prev) => {
      const next = new Set(prev)
      if (hideWeak) next.delete('weak public mention')
      else next.add('weak public mention')
      // also filter by strength visually via hideWeak
      return next
    })
  }, [hideWeak])

  const filteredEdges = useMemo(() => {
    return edges.filter((e) => {
      if (!enabledTypes.has(e.type)) return false
      if (hideWeak && e.strength < WEAK_THRESHOLD) return false
      return true
    })
  }, [enabledTypes, hideWeak])

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
    [activeNodeIds],
  )

  const selected = getNode(selectedId)
  const selectedEdges = selected ? getEdgesForNode(selected.id) : []

  // Path highlight: strongest ranked path from you to selected
  const { pathNodeIds, pathEdgeIds } = useMemo(() => {
    const empty = { pathNodeIds: new Set<string>(), pathEdgeIds: new Set<string>() }
    if (!highlightPath || selectedId === YOU_ID) return empty
    const paths = findPaths(selectedId, {
      maxDepth: 5,
      maxPaths: 5,
      minStrength: hideWeak ? WEAK_THRESHOLD : 0.15,
      allowedTypes: [...enabledTypes],
    })
    if (!paths.length) return empty
    return {
      pathNodeIds: new Set(paths[0].nodeIds),
      pathEdgeIds: new Set(paths[0].hops.map((h) => h.edge.id)),
    }
  }, [selectedId, highlightPath, hideWeak, enabledTypes])

  useEffect(() => {
    const svgEl = svgRef.current
    const gEl = gRef.current
    if (!svgEl || !gEl) return

    const width = svgEl.clientWidth || 800
    const height = svgEl.clientHeight || 600

    const simNodes: SimNode[] = graphNodes.map((n) => ({ ...n }))
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
      .attr('class', 'links')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', (d) => {
        const s = d.edge.strength
        if (pathEdgeIds.has(d.edge.id)) return '#c4a35a'
        return s < WEAK_THRESHOLD ? '#3d4455' : `rgba(154, 149, 140, ${0.25 + s * 0.55})`
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
      .attr('class', 'nodes')
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

    select(svgEl).call(zoomBehavior as never)
    select(svgEl).call(zoomBehavior.transform as never, zoomIdentity.translate(0, 0).scale(1))

    return () => {
      simulation.stop()
    }
  }, [graphNodes, filteredEdges, activeNodeIds, selectedId, pathNodeIds, pathEdgeIds, navigate, setParams])

  function toggleType(t: string) {
    setEnabledTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  return (
    <Shell title="Graph view" active="graph">
      <div className="graph-layout">
        <div className="graph-canvas-wrap">
          <div className="graph-toolbar">
            <button
              type="button"
              className={`chip ${hideWeak ? 'on' : ''}`}
              onClick={() => setHideWeak((v) => !v)}
            >
              {hideWeak ? 'Weak links hidden' : 'Show weak links'}
            </button>
            <button
              type="button"
              className={`chip ${highlightPath ? 'on' : ''}`}
              onClick={() => setHighlightPath((v) => !v)}
            >
              Highlight intro path
            </button>
            {(['lawyer', 'family', 'partner', 'political ally', 'co-founder', 'investor', 'podcast guest'] as const).map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  className={`chip ${enabledTypes.has(t) ? 'on' : ''}`}
                  onClick={() => toggleType(t)}
                >
                  {t}
                </button>
              ),
            )}
          </div>
          <svg ref={svgRef}>
            <g ref={gRef} />
          </svg>
          <div className="graph-hint">Scroll to zoom · drag nodes · double-click opens note</div>
        </div>
        <aside className="side-panel">
          {selected ? (
            <>
              <div>
                <div className="panel-label">Selected node</div>
                <h2 className="panel-title">{selected.name}</h2>
                <div className="panel-type">{NODE_TYPE_LABEL[selected.type]}</div>
                <p className="panel-body">{selected.summary}</p>
                {selected.tags.length > 0 && (
                  <div className="tag-row" style={{ marginTop: '0.75rem' }}>
                    {selected.tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '1rem' }}
                  onClick={() => navigate(`/person/${selected.id}`)}
                >
                  Open note
                </button>
                {selected.type === 'person' && selected.id !== YOU_ID && (
                  <button
                    type="button"
                    className="chip"
                    style={{ marginTop: '0.5rem', width: '100%' }}
                    onClick={() => navigate(`/paths?to=${selected.id}`)}
                  >
                    Find path to {selected.name.split(' ')[0]}
                  </button>
                )}
              </div>
              <div>
                <div className="panel-label">Relationships</div>
                <div className="edge-list">
                  {selectedEdges.map((edge) => {
                    const other = getNode(otherEnd(edge, selected.id))
                    if (!other) return null
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
                        <div className="etype">{edge.type}</div>
                        <div className="ename">{other.name}</div>
                        <div className="eevidence">
                          strength {(edge.strength * 100).toFixed(0)}% · {edge.evidence[0]?.title}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <p className="panel-body">Select a node</p>
          )}
        </aside>
      </div>
    </Shell>
  )
}
