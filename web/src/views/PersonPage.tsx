import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { NODE_TYPE_LABEL, nodes } from '../data/seed'
import { bestFirstHop, findPaths, getEdgesForNode, getNode, otherEnd } from '../data/paths'
import type { StrategyTag } from '../data/types'
import { Shell } from '../components/Shell'

const ALL_TAGS: StrategyTag[] = [
  'podcast target',
  'sponsor target',
  'investor',
  'real estate operator',
  'family office',
  'bridge person',
  'power broker',
]

export function PersonPage() {
  const { id = 'donald-trump' } = useParams()
  const navigate = useNavigate()
  const node = getNode(id)

  const storageKey = `sg-notes-${id}`
  const tagsKey = `sg-tags-${id}`

  const [notes, setNotes] = useState(() => {
    try {
      return localStorage.getItem(storageKey) ?? node?.privateNotes ?? ''
    } catch {
      return node?.privateNotes ?? ''
    }
  })
  const [tags, setTags] = useState<StrategyTag[]>(() => {
    try {
      const raw = localStorage.getItem(tagsKey)
      if (raw) return JSON.parse(raw) as StrategyTag[]
    } catch {
      /* ignore */
    }
    return node?.tags ?? []
  })

  useEffect(() => {
    try {
      const savedNotes = localStorage.getItem(storageKey)
      const savedTags = localStorage.getItem(tagsKey)
      setNotes(savedNotes ?? node?.privateNotes ?? '')
      setTags(savedTags ? (JSON.parse(savedTags) as StrategyTag[]) : (node?.tags ?? []))
    } catch {
      setNotes(node?.privateNotes ?? '')
      setTags(node?.tags ?? [])
    }
  }, [node, storageKey, tagsKey])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, notes)
    } catch {
      /* ignore */
    }
  }, [notes, storageKey])

  useEffect(() => {
    try {
      localStorage.setItem(tagsKey, JSON.stringify(tags))
    } catch {
      /* ignore */
    }
  }, [tags, tagsKey])

  const rels = useMemo(() => (node ? getEdgesForNode(node.id) : []), [node])
  const backlinks = useMemo(() => {
    if (!node) return []
    return rels
      .map((e) => getNode(otherEnd(e, node.id)))
      .filter(Boolean)
  }, [node, rels])

  const introHint = useMemo(() => {
    if (!node || node.type !== 'person') return null
    const paths = findPaths(node.id, { maxDepth: 5, maxPaths: 8 })
    return bestFirstHop(paths)
  }, [node])

  if (!node) {
    return (
      <Shell title="Person" active="person">
        <div className="empty-state">
          Node not found. <Link to="/">Back to graph</Link>
        </div>
      </Shell>
    )
  }

  function toggleTag(t: StrategyTag) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  return (
    <Shell title={`Note · ${node.name}`} active="person">
      <div className="note-layout">
        <article className="note-main">
          <h1 className="note-title">{node.name}</h1>
          <div className="note-meta">
            {NODE_TYPE_LABEL[node.type]}
            {node.knownByUser ? ' · in your warm network' : ''}
            {node.warmth != null ? ` · warmth ${(node.warmth * 100).toFixed(0)}%` : ''}
          </div>

          <section className="note-section" style={{ animationDelay: '0.05s' }}>
            <h2>Summary</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>{node.summary}</p>
          </section>

          {introHint && (
            <section className="note-section" style={{ animationDelay: '0.08s' }}>
              <h2>Possible intro path</h2>
              <div className="verdict" style={{ marginTop: 0 }}>
                <strong>Ask {introHint.node.name}</strong>
                <p>
                  Best first hop · score {(introHint.path.scores.total * 100).toFixed(0)} ·{' '}
                  {introHint.path.rationale}
                </p>
                <button
                  type="button"
                  className="chip on"
                  style={{ marginTop: '0.75rem' }}
                  onClick={() => navigate(`/paths?to=${node.id}`)}
                >
                  Open Path Finder
                </button>
              </div>
              <div className="path-chain" style={{ marginTop: '0.85rem' }}>
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
            </section>
          )}

          <section className="note-section" style={{ animationDelay: '0.1s' }}>
            <h2>Verified relationships</h2>
            {rels
              .slice()
              .sort((a, b) => b.strength - a.strength)
              .map((edge) => {
                const other = getNode(otherEnd(edge, node.id))
                if (!other) return null
                return (
                  <div key={edge.id} className="rel-row">
                    <div className="rel-type">{edge.type}</div>
                    <div>
                      <button
                        type="button"
                        className="wiki-link"
                        onClick={() => navigate(`/person/${other.id}`)}
                      >
                        [[{other.name}]]
                      </button>
                      <span
                        className="strength-bar"
                        style={{ width: `${Math.max(12, edge.strength * 80)}px` }}
                        title={`Strength ${edge.strength}`}
                      />
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {edge.explanation}
                      </div>
                      {edge.evidence.map((ev, i) => (
                        <div key={i} className="citation">
                          [{i + 1}]{' '}
                          <a href={ev.url} target="_blank" rel="noreferrer">
                            {ev.title}
                          </a>{' '}
                          — {ev.snippet}{' '}
                          <span style={{ opacity: 0.7 }}>
                            ({ev.date} · {ev.quality})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
          </section>

          <section className="note-section" style={{ animationDelay: '0.14s' }}>
            <h2>Timeline</h2>
            {node.timeline.map((t) => (
              <div key={t.date + t.label} className="timeline-item">
                <span className="date">{t.date}</span>
                <span>{t.label}</span>
              </div>
            ))}
          </section>
        </article>

        <aside className="note-aside">
          <div className="panel-label">Strategy tags</div>
          <div className="tag-row" style={{ marginBottom: '1.25rem' }}>
            {ALL_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip ${tags.includes(t) ? 'on' : ''}`}
                onClick={() => toggleTag(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="panel-label">Private notes</div>
          <textarea
            className="notes-box"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Manual curation only you see — intro context, awkwardness, ask timing…"
          />
          <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '0.35rem' }}>
            Saved in this browser only (manual curation — not synced).
          </p>

          <div className="panel-label" style={{ marginTop: '1.5rem' }}>
            Backlinks
          </div>
          {backlinks.map((n) =>
            n ? (
              <button
                key={n.id}
                type="button"
                className="backlink"
                onClick={() => navigate(`/person/${n.id}`)}
              >
                ← [[{n.name}]]
              </button>
            ) : null,
          )}

          <div className="panel-label" style={{ marginTop: '1.5rem' }}>
            Jump
          </div>
          <button type="button" className="chip" onClick={() => navigate(`/?focus=${node.id}`)}>
            Show in graph
          </button>
          <div style={{ marginTop: '0.75rem' }}>
            <div className="panel-label">Other people</div>
            {nodes
              .filter((n) => n.type === 'person' && n.id !== node.id)
              .slice(0, 8)
              .map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="backlink"
                  onClick={() => navigate(`/person/${n.id}`)}
                >
                  [[{n.name}]]
                </button>
              ))}
          </div>
        </aside>
      </div>
    </Shell>
  )
}
