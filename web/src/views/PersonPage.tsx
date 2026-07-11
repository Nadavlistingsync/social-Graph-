import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DEFAULT_TARGET_ID, NODE_TYPE_LABEL, YOU_ID } from '../data/seed'
import { bestFirstHop, findPaths, getEdgesForNode, getNode, otherEnd } from '../data/paths'
import { isKnown, setKnown, useKnownVersion } from '../data/userOverrides'
import { usePageTitle } from '../hooks/usePageTitle'
import { Shell } from '../components/Shell'

export function PersonPage() {
  const { id = DEFAULT_TARGET_ID } = useParams()
  const navigate = useNavigate()
  const knownVersion = useKnownVersion()
  const node = getNode(id)
  const storageKey = `sg-notes-${id}`

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
    try {
      localStorage.setItem(storageKey, notes)
    } catch {
      /* ignore */
    }
  }, [notes, storageKey])

  const rels = useMemo(() => (node ? getEdgesForNode(node.id) : []), [node])

  const introHint = useMemo(() => {
    // knownVersion invalidates the hint when the user toggles “I know them”.
    void knownVersion
    if (!node || node.type !== 'person' || node.id === YOU_ID) return null
    return bestFirstHop(findPaths(node.id, { maxDepth: 5, maxPaths: 5 }))
  }, [node, knownVersion])

  usePageTitle(node?.name)

  if (!node) {
    return (
      <Shell active="person">
        <div className="empty-state" style={{ width: '100%' }}>
          Not found. <Link to="/">Back</Link>
        </div>
      </Shell>
    )
  }

  const known = isKnown(node)
  const isYou = node.id === YOU_ID
  const timeline = node.timeline.filter((t) => t.label)

  return (
    <Shell active="person">
      <div className="note-layout simple">
        <article className="note-main">
          <h1 className="note-title">{node.name}</h1>
          <div className="note-meta">
            {NODE_TYPE_LABEL[node.type]}
            {isYou ? ' · this is you' : known ? ' · you know them' : ''}
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

          {introHint && (
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
            {rels
              .slice()
              .sort((a, b) => b.strength - a.strength)
              .map((edge) => {
                const other = getNode(otherEnd(edge, node.id))
                if (!other) return null
                const source = edge.evidence[0]
                const isPrivateSource = source ? source.url.startsWith('#') : false
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
                          {isPrivateSource ? (
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

          {timeline.length > 0 && (
            <section className="note-section">
              <h2>Timeline</h2>
              {timeline.map((t) => (
                <div key={`${t.date}-${t.label}`} className="timeline-item">
                  <span className="date">{t.date}</span>
                  <span>{t.label}</span>
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
          {node.type === 'person' && !isYou && (
            <button
              type="button"
              className={`chip ${known ? 'on' : ''}`}
              style={{ marginBottom: '0.5rem' }}
              onClick={() => setKnown(node, !known)}
              aria-pressed={known}
            >
              {known ? '✓ I know them' : 'I know them'}
            </button>
          )}
          <button type="button" className="chip" onClick={() => navigate(`/graph?focus=${node.id}`)}>
            Show in graph
          </button>
          {node.type === 'person' && !isYou && (
            <button
              type="button"
              className="chip"
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
