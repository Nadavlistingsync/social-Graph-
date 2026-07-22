import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { bestFirstHop, findPaths, getNode } from '../data/paths'
import { Shell } from '../components/Shell'
import { useGraph } from '../context/GraphContext'
import { usePreferences } from '../context/PreferencesContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function PathFinder() {
  const { version, youId, nodes, profile, resolveTarget, ensureTarget } = useGraph()
  const { version: prefVersion } = usePreferences()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const people = useMemo(() => {
    void version
    return nodes.filter((n) => n.type === 'person' && n.id !== youId)
  }, [nodes, youId, version])

  const defaultTarget =
    profile.targetPersonId ||
    (profile.loadSample ? 'donald-trump' : people[0]?.id ?? '')
  const paramRaw = params.get('to') || params.get('q')

  const [targetId, setTargetId] = useState(() => {
    if (paramRaw) {
      const hit = people.find((p) => p.id === paramRaw || p.name.toLowerCase() === paramRaw.toLowerCase())
      if (hit) return hit.id
    }
    if (defaultTarget && people.some((p) => p.id === defaultTarget)) return defaultTarget
    return people[0]?.id || ''
  })
  const [query, setQuery] = useState(() => getNode(targetId)?.name ?? profile.targetPerson ?? '')

  useEffect(() => {
    const raw = params.get('to') || params.get('q')
    if (!raw) return
    const next = resolveTarget(raw)
    if (next && next !== targetId) {
      setTargetId(next)
      setQuery(getNode(next)?.name ?? raw)
    }
  }, [params, resolveTarget, targetId])

  function chooseTarget(id: string) {
    setTargetId(id)
    const name = getNode(id)?.name
    if (name) setQuery(name)
    setParams(id ? { to: id } : {}, { replace: true })
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    const id = ensureTarget(trimmed)
    if (id) chooseTarget(id)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return people.slice(0, 12)
    return people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12)
  }, [people, query])

  const paths = useMemo(() => {
    void version
    void prefVersion
    if (!targetId) return []
    return findPaths(targetId, { maxDepth: 5, maxPaths: 5, minStrength: 0.35 })
  }, [targetId, version, prefVersion])
  const verdict = bestFirstHop(paths)
  const target = getNode(targetId)
  const ask = verdict?.node ?? null
  const bestPath = verdict?.path ?? null

  useDocumentTitle(target ? `Intro to ${target.name}` : 'Find intro')

  return (
    <Shell active="paths">
      <div className="find-page" id="main-find">
        <div className="find-hero">
          <p className="eyebrow">Coming into focus</p>
          <h1>Who do you want to reach?</h1>
          <p className="lede">
            Search or pick someone. We’ll show the best person in your network to ask for an intro.
          </p>

          {people.length === 0 ? (
            <div className="verdict">
              <strong>Build your network first</strong>
              <p>Add people you know, then come back here.</p>
              <button type="button" className="btn-primary" onClick={() => navigate('/')}>
                Open network
              </button>
            </div>
          ) : (
            <>
              <form className="field" onSubmit={submitSearch}>
                <label className="field-label" htmlFor="to-search">
                  Person
                </label>
                <input
                  id="to-search"
                  list="find-people"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a name…"
                  autoComplete="off"
                />
                <datalist id="find-people">
                  {people.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
                <div className="panel-actions" style={{ marginTop: '0.75rem' }}>
                  <button type="submit" className="btn-primary">
                    Find intro
                  </button>
                  {filtered.length > 0 && filtered[0].id !== targetId && (
                    <button
                      type="button"
                      className="btn-quiet"
                      onClick={() => chooseTarget(filtered[0].id)}
                    >
                      Use {filtered[0].name.split(' ')[0]}
                    </button>
                  )}
                </div>
              </form>

              {people.length > 1 && (
                <div className="field">
                  <label className="field-label" htmlFor="to">
                    Or pick from your graph
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
              )}

              {!targetId ? (
                <div className="verdict">
                  <strong>Enter a name above</strong>
                  <p>We’ll add them as a target if they’re not in your graph yet.</p>
                </div>
              ) : !ask || !bestPath ? (
                <div className="verdict">
                  <strong>No intro path yet</strong>
                  <p>
                    Mark people you actually know on the network map, or add connections between
                    your contacts and {target?.name ?? 'them'}, then try again.
                  </p>
                  <button type="button" className="btn-quiet" onClick={() => navigate('/')}>
                    Back to network
                  </button>
                </div>
              ) : ask.id === targetId ? (
                <div className="verdict">
                  <strong>You already know {target?.name}</strong>
                  <p>No intro needed — reach out directly.</p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => navigate(`/person/${targetId}`)}
                  >
                    Open note
                  </button>
                </div>
              ) : (
                <div className="verdict">
                  <strong>Ask {ask.name}</strong>
                  <p>
                    Best first step toward {target?.name}.
                    {bestPath.rationale ? ` ${bestPath.rationale}` : ''}
                  </p>
                  <div className="panel-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => navigate(`/person/${ask.id}`)}
                    >
                      Open {ask.name.split(' ')[0]}
                    </button>
                    <button
                      type="button"
                      className="btn-quiet"
                      onClick={() => navigate(`/?focus=${ask.id}`)}
                    >
                      See on map
                    </button>
                  </div>
                </div>
              )}

              {paths.length > 1 && ask && ask.id !== targetId && (
                <div className="alt-paths">
                  <div className="panel-label">Other options</div>
                  {paths.slice(1, 4).map((p) => {
                    const hop = getNode(p.firstHopId)
                    if (!hop) return null
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className="alt-path"
                        onClick={() => navigate(`/person/${hop.id}`)}
                      >
                        Ask {hop.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Shell>
  )
}
