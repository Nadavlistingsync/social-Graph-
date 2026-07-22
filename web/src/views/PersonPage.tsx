import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { NODE_TYPE_LABEL } from '../data/seed'
import { getYouId } from '../data/graphStore'
import { bestFirstHop, findPaths, getEdgesForNode, getNode, otherEnd } from '../data/paths'
import { saveNote } from '../data/userDataBlob'
import { Shell } from '../components/Shell'
import { AddConnectionModal } from '../components/GraphModals'
import { useGraph } from '../context/GraphContext'
import { usePreferences } from '../context/PreferencesContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const YOU_ID = getYouId()

export function PersonPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { version: graphVersion } = useGraph()
  const { version, getWarmth, setWarmth, isAwkward, setAwkward } = usePreferences()
  const [connOpen, setConnOpen] = useState(false)
  const node = id ? getNode(id) : undefined
  const storageKey = `sg-notes-${id}`

  useDocumentTitle(node?.name)

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
    saveNote(id, notes)
  }, [notes, id])

  const rels = useMemo(() => {
    void version
    void graphVersion
    return node ? getEdgesForNode(node.id) : []
  }, [node, version, graphVersion])

  const introHint = useMemo(() => {
    void version
    void graphVersion
    if (!node || node.type !== 'person' || node.id === YOU_ID) return null
    const hint = bestFirstHop(findPaths(node.id, { maxDepth: 5, maxPaths: 5, minStrength: 0.35 }))
    // Already a direct contact — no intro needed
    if (hint && (hint.node.id === node.id || hint.path.hops.length === 1)) return null
    return hint
  }, [node, version, graphVersion])

  const warmth = node ? getWarmth(node) : null

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
      <div className="note-layout simple" id="main">
        <article className="note-main">
          <h1 className="note-title">{node.name}</h1>
          <div className="note-meta">
            {NODE_TYPE_LABEL[node.type]}
            {warmth?.knownByUser ? ' · you know them' : ''}
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

          {node.type === 'person' && node.id !== YOU_ID && warmth && (
            <section className="note-section">
              <h2>How well you know them</h2>
              <p className="section-hint">
                1–10, private to you. Path ranking uses this for first-hop scoring.
                {warmth.reason ? ` · ${warmth.reason}` : ''}
              </p>
              <div className="rate-scale person-rate-scale" role="group" aria-label="Score 1 to 10">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`rate-scale-btn ${(warmth.score ?? Math.round(warmth.warmth * 10)) === n ? 'on' : ''}`}
                    onClick={() =>
                      setWarmth(node.id, {
                        knownByUser: n >= 4,
                        warmth: n / 10,
                        score: n,
                        reason: 'You set this score',
                        source: 'user',
                        confirmed: true,
                        ratedAt: new Date().toISOString(),
                      })
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
            </section>
          )}

          {introHint && node.id !== YOU_ID && (
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
            <div className="section-header-row">
              <h2>Relationships</h2>
              <button type="button" className="chip" onClick={() => setConnOpen(true)}>
                + Add connection
              </button>
            </div>
            {rels.length === 0 && (
              <div className="empty-state" style={{ padding: '1rem 0' }}>
                No relationships recorded yet.
              </div>
            )}
            {rels
              .slice()
              .sort((a, b) => b.strength - a.strength)
              .map((edge) => {
                const other = getNode(otherEnd(edge, node.id))
                if (!other) return null
                const awkward = isAwkward(edge.id)
                return (
                  <div key={edge.id} className={`rel-row ${awkward ? 'awkward' : ''}`}>
                    <div className="rel-type">
                      {edge.type}
                      <span
                        className="strength-bar"
                        style={{ width: `${Math.round(edge.strength * 48)}px` }}
                        title={`Strength ${Math.round(edge.strength * 100)}`}
                      />
                    </div>
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
                      {edge.evidence.map((source) => {
                        const illustrative = source.url.startsWith('#')
                        return (
                          <div key={source.title + source.date} className="citation">
                            {illustrative ? (
                              <span>
                                {source.title} <span className="badge-illust">illustrative</span>
                              </span>
                            ) : (
                              <a href={source.url} target="_blank" rel="noreferrer">
                                {source.title}
                              </a>
                            )}
                          </div>
                        )
                      })}
                      <button
                        type="button"
                        className={`chip awkward-toggle ${awkward ? 'on' : ''}`}
                        onClick={() => setAwkward(edge.id, !awkward)}
                      >
                        {awkward ? 'Awkward intro — excluded from paths' : 'Mark awkward intro'}
                      </button>
                    </div>
                  </div>
                )
              })}
          </section>

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
          <button type="button" className="chip" onClick={() => navigate(`/?focus=${node.id}`)}>
            See on map
          </button>
          {node.type === 'person' && node.id !== YOU_ID && (
            <button
              type="button"
              className="chip on"
              style={{ marginTop: '0.5rem' }}
              onClick={() => navigate(`/find?to=${node.id}`)}
            >
              Find intro
            </button>
          )}
        </aside>
      </div>
      <AddConnectionModal
        open={connOpen}
        onClose={() => setConnOpen(false)}
        fromId={node.id}
        fromName={node.name}
      />
    </Shell>
  )
}
