import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { nodes, YOU_ID } from '../data/seed'
import { bestFirstHop, findPaths, getNode } from '../data/paths'
import { Shell } from '../components/Shell'

export function PathFinder() {
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

  const paths = useMemo(
    () => findPaths(targetId, { maxDepth: 5, maxPaths: 5, minStrength: 0.35 }),
    [targetId],
  )
  const verdict = bestFirstHop(paths)
  const target = getNode(targetId)

  useEffect(() => {
    document.title = target
      ? `Path to ${target.name} | Social Graph`
      : 'Find path | Social Graph'
  }, [target])

  return (
    <Shell active="paths">
      <div className="path-layout simple">
        <div className="path-form">
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

          {verdict ? (
            <div className="verdict">
              <strong>Ask {verdict.node.name}</strong>
              <p>Best warm intro to {target?.name}.</p>
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
              <p>Add someone you know who’s closer to the target.</p>
            </div>
          )}
        </div>

        <div className="path-results">
          <div className="panel-label">Other paths</div>
          {paths.slice(1).map((path, idx) => (
            <div key={path.id} className="path-card" style={{ animationDelay: `${idx * 0.04}s` }}>
              <div className="path-chain">
                {path.nodeIds.map((nid, i) => {
                  const n = getNode(nid)
                  return (
                    <span key={nid + i} style={{ display: 'contents' }}>
                      {i > 0 && <span className="arrow">→</span>}
                      <button
                        type="button"
                        className="node-pill"
                        onClick={() => navigate(`/person/${nid}`)}
                      >
                        {n?.name ?? nid}
                      </button>
                    </span>
                  )
                })}
              </div>
              <div className="path-rationale">{path.rationale}</div>
            </div>
          ))}
          {paths.length <= 1 && (
            <div className="empty-state">Only one strong path right now.</div>
          )}
        </div>
      </div>
    </Shell>
  )
}
