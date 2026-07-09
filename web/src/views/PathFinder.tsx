import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { nodes, YOU_ID } from '../data/seed'
import { bestFirstHop, findPaths, getNode } from '../data/paths'
import type { RankedPath } from '../data/types'
import { Shell } from '../components/Shell'

export function PathFinder() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const people = useMemo(
    () => nodes.filter((n) => n.type === 'person' && n.id !== YOU_ID),
    [],
  )
  const [targetId, setTargetId] = useState(params.get('to') ?? 'donald-trump')
  const [hideWeak, setHideWeak] = useState(true)
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null)

  const paths: RankedPath[] = useMemo(() => {
    return findPaths(targetId, {
      maxDepth: 5,
      maxPaths: 12,
      minStrength: hideWeak ? 0.35 : 0.15,
    })
  }, [targetId, hideWeak])

  const verdict = bestFirstHop(paths)
  const target = getNode(targetId)
  const you = getNode(YOU_ID)

  return (
    <Shell title="Path Finder" active="paths">
      <div className="path-layout">
        <div className="path-form">
          <h1>I want to reach…</h1>
          <p className="lede">
            Who is the best person you know who can credibly get you there? Ranked by warmth,
            strength, evidence, recency, and usefulness.
          </p>

          <div className="field">
            <label className="field-label" htmlFor="from">
              From
            </label>
            <input id="from" value={you?.name ?? 'You'} disabled />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="to">
              Target
            </label>
            <select
              id="to"
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value)
                setSelectedPathId(null)
              }}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className={`chip ${hideWeak ? 'on' : ''}`}
            style={{ marginBottom: '1rem' }}
            onClick={() => setHideWeak((v) => !v)}
          >
            {hideWeak ? 'Ignoring weak mentions' : 'Including weak mentions'}
          </button>

          {verdict ? (
            <div className="verdict">
              <strong>Ask {verdict.node.name}</strong>
              <p>
                Strongest credible first hop to {target?.name}. Score{' '}
                {(verdict.path.scores.total * 100).toFixed(0)} / 100.
              </p>
              <p style={{ marginTop: '0.5rem' }}>{verdict.path.rationale}</p>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="chip on"
                  onClick={() => navigate(`/person/${verdict.node.id}`)}
                >
                  Open {verdict.node.name.split(' ')[0]}’s note
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => navigate(`/?focus=${targetId}`)}
                >
                  See in graph
                </button>
              </div>
            </div>
          ) : (
            <div className="verdict">
              <strong>No path found</strong>
              <p>Try enabling weak links or adding a warm contact closer to the target.</p>
            </div>
          )}

          <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
            Automatic: public edges + path search. Manual: who you know, private notes, strategy
            tags, strength overrides.
          </p>
        </div>

        <div className="path-results">
          <div className="panel-label">Ranked paths · {paths.length} found</div>
          {paths.map((path, idx) => (
            <div
              key={path.id}
              className={`path-card ${selectedPathId === path.id ? 'selected' : ''}`}
              style={{ animationDelay: `${idx * 0.04}s` }}
              onClick={() => setSelectedPathId(path.id)}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedPathId(path.id)}
              role="button"
              tabIndex={0}
            >
              <div className="path-chain">
                {path.nodeIds.map((nid, i) => {
                  const n = getNode(nid)
                  return (
                    <span key={nid + i} style={{ display: 'contents' }}>
                      {i > 0 && <span className="arrow">→</span>}
                      <button
                        type="button"
                        className={`node-pill ${i === 1 ? 'first' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/person/${nid}`)
                        }}
                      >
                        {n?.name ?? nid}
                      </button>
                    </span>
                  )
                })}
              </div>
              <div className="score-row">
                <span className="total">#{idx + 1} · {(path.scores.total * 100).toFixed(0)}</span>
                <span>warmth {(path.scores.warmth * 100).toFixed(0)}</span>
                <span>strength {(path.scores.strength * 100).toFixed(0)}</span>
                <span>credibility {(path.scores.credibility * 100).toFixed(0)}</span>
                <span>recency {(path.scores.recency * 100).toFixed(0)}</span>
                <span>useful {(path.scores.usefulness * 100).toFixed(0)}</span>
              </div>
              <div className="path-rationale">{path.rationale}</div>
              <div style={{ marginTop: '0.5rem' }}>
                {path.hops.map((h) => (
                  <div key={h.edge.id} className="citation">
                    {h.edge.type}: {h.edge.explanation} —{' '}
                    <a href={h.edge.evidence[0]?.url} target="_blank" rel="noreferrer">
                      {h.edge.evidence[0]?.title}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!paths.length && (
            <div className="empty-state">No intro paths with current filters.</div>
          )}
        </div>
      </div>
    </Shell>
  )
}
