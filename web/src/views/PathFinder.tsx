import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { nodes, YOU_ID } from '../data/seed'
import { bestFirstHop, findPaths, getNode } from '../data/paths'
import { Shell } from '../components/Shell'
import { usePreferences } from '../context/PreferencesContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import type { RankedPath } from '../data/types'

function formatScore(n: number): string {
  return Math.round(n * 100).toString()
}

function ScoreRow({ path }: { path: RankedPath }) {
  const s = path.scores
  return (
    <div className="score-row" aria-label="Path scores">
      <span className="total">Score {formatScore(s.total)}</span>
      <span>Warmth {formatScore(s.warmth)}</span>
      <span>Strength {formatScore(s.strength)}</span>
      <span>Evidence {formatScore(s.credibility)}</span>
      <span>Recency {formatScore(s.recency)}</span>
    </div>
  )
}

export function PathFinder() {
  const { version } = usePreferences()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const people = useMemo(
    () => nodes.filter((n) => n.type === 'person' && n.id !== YOU_ID),
    [],
  )

  const paramTarget = params.get('to')
  const initial =
    paramTarget && people.some((p) => p.id === paramTarget) ? paramTarget : 'donald-trump'
  const [targetId, setTargetId] = useState(initial)

  useEffect(() => {
    const next = params.get('to')
    if (next && people.some((p) => p.id === next) && next !== targetId) {
      setTargetId(next)
    }
  }, [params, people, targetId])

  function chooseTarget(id: string) {
    setTargetId(id)
    setParams(id === 'donald-trump' ? {} : { to: id }, { replace: true })
  }

  const paths = useMemo(() => {
    void version
    return findPaths(targetId, { maxDepth: 5, maxPaths: 8, minStrength: 0.35 })
  }, [targetId, version])
  const verdict = bestFirstHop(paths)
  const target = getNode(targetId)
  const directContact =
    Boolean(target?.knownByUser) &&
    paths.length === 1 &&
    paths[0]?.hops.length === 1 &&
    paths[0]?.firstHopId === targetId

  useDocumentTitle(target ? `Path to ${target.name}` : 'Find path')

  return (
    <Shell active="paths">
      <div className="path-layout simple" id="main">
        <div className="path-form">
          <p className="demo-banner">Illustrative public scaffolding — not verified private access.</p>
          <h1>Who can get me to…</h1>
          <p className="lede">Pick a target. We’ll show the best person you know to ask.</p>

          <div className="field">
            <label className="field-label" htmlFor="to">
              Target
            </label>
            <select
              id="to"
              value={targetId}
              onChange={(e) => chooseTarget(e.target.value)}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {directContact ? (
            <div className="verdict">
              <strong>You already know {target?.name}</strong>
              <p>No intro needed — open their note or ask them directly.</p>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: 'auto' }}
                  onClick={() => navigate(`/person/${targetId}`)}
                >
                  Open note
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => navigate(`/graph?focus=${targetId}`)}
                >
                  See graph
                </button>
              </div>
            </div>
          ) : verdict ? (
            <div className="verdict">
              <strong>Ask {verdict.node.name}</strong>
              <p>Best warm intro to {target?.name}.</p>
              <ScoreRow path={verdict.path} />
              <div className="path-chain" style={{ marginTop: '0.85rem' }}>
                {verdict.path.nodeIds.map((nid, i) => {
                  const n = getNode(nid)
                  return (
                    <span key={nid} style={{ display: 'contents' }}>
                      {i > 0 && <span className="arrow">→</span>}
                      <button
                        type="button"
                        className={`node-pill ${i === 1 ? 'first' : ''}`}
                        onClick={() => navigate(`/person/${nid}`)}
                      >
                        {n?.name ?? nid}
                      </button>
                    </span>
                  )
                })}
              </div>
              <p className="path-rationale" style={{ marginTop: '0.65rem' }}>
                {verdict.path.rationale}
              </p>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: 'auto' }}
                  onClick={() => navigate(`/person/${verdict.node.id}`)}
                >
                  Open {verdict.node.name.split(' ')[0]}
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => navigate(`/graph?focus=${targetId}`)}
                >
                  See graph
                </button>
              </div>
            </div>
          ) : (
            <div className="verdict">
              <strong>No path found</strong>
              <p>Mark someone you know who’s closer to the target, or show weak links on the graph.</p>
            </div>
          )}
        </div>

        <div className="path-results">
          <div className="panel-label">Other paths</div>
          {paths.length === 0 && (
            <div className="empty-state">No strong path to {target?.name ?? 'this person'} yet.</div>
          )}
          {paths.length === 1 && (
            <div className="empty-state">Only one strong path right now.</div>
          )}
          {paths.slice(1).map((path, idx) => (
            <div
              key={path.id}
              className="path-card"
              style={{ animationDelay: `${idx * 0.04}s` }}
              onClick={() => navigate(`/person/${path.firstHopId}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/person/${path.firstHopId}`)
              }}
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
                        className="node-pill"
                        onClick={(ev) => {
                          ev.stopPropagation()
                          navigate(`/person/${nid}`)
                        }}
                      >
                        {n?.name ?? nid}
                      </button>
                    </span>
                  )
                })}
              </div>
              <ScoreRow path={path} />
              <div className="path-rationale">{path.rationale}</div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  )
}
