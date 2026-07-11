import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { NODE_TYPE_LABEL } from '../data/seed'
import { bestFirstHop, findPaths, getEdgesForNode, getNode, otherEnd } from '../data/paths'
import {
  getConnectionPreference,
  saveConnectionPreference,
  type ConnectionPreference,
} from '../data/preferences'
import { Shell } from '../components/Shell'

export function PersonPage() {
  const { id = 'donald-trump' } = useParams()
  const navigate = useNavigate()
  const node = getNode(id)
  const storageKey = `sg-notes-${id}`
  const initialPreference = node
    ? getConnectionPreference(node)
    : { known: false, warmth: 0.7 }
  const [connection, setConnection] = useState<ConnectionPreference>(initialPreference)
  const [saveError, setSaveError] = useState(false)

  const [notes, setNotes] = useState(() => {
    try {
      return localStorage.getItem(storageKey) ?? node?.privateNotes ?? ''
    } catch {
      return node?.privateNotes ?? ''
    }
  })

  useEffect(() => {
    try {
      setNotes(localStorage.getItem(storageKey) ?? node?.privateNotes ?? '')
    } catch {
      setNotes(node?.privateNotes ?? '')
    }
  }, [node, storageKey])

  useEffect(() => {
    if (node) setConnection(getConnectionPreference(node))
    setSaveError(false)
  }, [node])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, notes)
    } catch {
      /* ignore */
    }
  }, [notes, storageKey])

  const rels = node ? getEdgesForNode(node.id) : []
  const introHint =
    node?.type === 'person'
      ? bestFirstHop(findPaths(node.id, { maxDepth: 5, maxPaths: 5 }))
      : null

  function updateConnection(next: ConnectionPreference) {
    if (!node) return
    setConnection(next)
    setSaveError(!saveConnectionPreference(node.id, next))
  }

  if (!node) {
    return (
      <Shell active="person">
        <div className="empty-state">
          Not found. <Link to="/">Back</Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell active="person">
      <div className="note-layout simple">
        <article className="note-main">
          <h1 className="note-title">{node.name}</h1>
          <div className="note-meta">
            {NODE_TYPE_LABEL[node.type]}
            {connection.known ? ` · warm contact (${Math.round(connection.warmth * 100)}%)` : ''}
          </div>

          <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>{node.summary}</p>

          {node.tags.length > 0 && (
            <div className="tag-row" style={{ marginBottom: '1.5rem' }}>
              {node.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          )}

          {introHint && node.id !== 'nadav' && (
            <section className="note-section">
              <h2>Who to ask</h2>
              <div className="verdict" style={{ marginTop: 0 }}>
                <strong>Ask {introHint.node.name}</strong>
                <div className="path-chain" style={{ marginTop: '0.75rem' }}>
                  {introHint.path.nodeIds.map((nid, i) => {
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
              </div>
            </section>
          )}

          <section className="note-section">
            <h2>Relationships</h2>
            {rels.length === 0 && <div className="empty-inline">No relationships mapped yet.</div>}
            {rels
              .slice()
              .sort((a, b) => b.strength - a.strength)
              .map((edge) => {
                const other = getNode(otherEnd(edge, node.id))
                if (!other) return null
                const source = edge.evidence[0]
                return (
                  <div key={edge.id} className="rel-row">
                    <div className="rel-type">{edge.type}</div>
                    <div>
                      <button
                        type="button"
                        className="wiki-link"
                        onClick={() => navigate(`/person/${other.id}`)}
                      >
                        {other.name}
                      </button>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {edge.explanation}
                      </div>
                      {source && (
                        <div className="citation">
                          {source.url.startsWith('#') ? (
                            <span>{source.title}</span>
                          ) : (
                            <a href={source.url} target="_blank" rel="noreferrer">
                              {source.title}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
          </section>

          {node.timeline.length > 0 && (
            <section className="note-section">
              <h2>Timeline</h2>
              {node.timeline.map((item) => (
                <div key={`${item.date}-${item.label}`} className="timeline-item">
                  <div className="date">{item.date}</div>
                  <div>{item.label}</div>
                </div>
              ))}
            </section>
          )}

          <section className="note-section">
            <h2>Your notes</h2>
            <textarea
              className="notes-box"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Private — only you see this"
            />
          </section>
        </article>

        <aside className="note-aside">
          {node.type === 'person' && node.id !== 'nadav' && (
            <section className="connection-editor" aria-label="Connection settings">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={connection.known}
                  onChange={(event) =>
                    updateConnection({ ...connection, known: event.target.checked })
                  }
                />
                I know this person
              </label>
              <label className="warmth-control">
                <span>
                  Relationship warmth
                  <strong>{Math.round(connection.warmth * 100)}%</strong>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(connection.warmth * 100)}
                  disabled={!connection.known}
                  onChange={(event) =>
                    updateConnection({
                      ...connection,
                      warmth: Number(event.target.value) / 100,
                    })
                  }
                />
              </label>
              <p className="editor-help">Saved only in this browser and used to rank intro paths.</p>
              {saveError && (
                <p className="save-error" role="alert">
                  Could not save this setting.
                </p>
              )}
            </section>
          )}
          <button type="button" className="chip" onClick={() => navigate(`/graph?focus=${node.id}`)}>
            Show in graph
          </button>
          {node.type === 'person' && node.id !== 'nadav' && (
            <button
              type="button"
              className="chip on"
              style={{ marginTop: '0.5rem' }}
              onClick={() => navigate(`/?to=${node.id}`)}
            >
              Find path here
            </button>
          )}
        </aside>
      </div>
    </Shell>
  )
}
