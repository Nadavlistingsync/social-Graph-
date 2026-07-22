import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DemoPathChain } from '../components/DemoPathChain'
import { bestFirstHop, findPaths, getNode, searchNodes } from '../data/paths'
import { DEMO_TARGET_ID, getDemoStep, isDemoMode } from '../data/demoMode'
import { MEGA_TRUMP_ID } from '../data/megaGraph'
import { Shell } from '../components/Shell'
import { useGraph } from '../context/GraphContext'
import { usePreferences } from '../context/PreferencesContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function PathFinder() {
  const { version, profile, isMegaSample, networkStats } = useGraph()
  const { version: prefVersion } = usePreferences()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const defaultTarget = isMegaSample || profile.megaSample
    ? MEGA_TRUMP_ID
    : profile.loadSample
      ? DEMO_TARGET_ID
      : ''

  const paramTarget = params.get('to')
  const [targetId, setTargetId] = useState(paramTarget || defaultTarget)
  const [searchQ, setSearchQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [revealKey, setRevealKey] = useState(0)

  const searchResults = useMemo(() => {
    void version
    if (!isMegaSample) return []
    return searchNodes(searchQ || 'a').slice(0, 12)
  }, [isMegaSample, searchQ, version])

  useEffect(() => {
    const next = params.get('to')
    if (next && next !== targetId) {
      setTargetId(next)
      setRevealKey((k) => k + 1)
      const node = getNode(next)
      if (node) setSearchQ(node.name)
    }
  }, [params, targetId])

  useEffect(() => {
    if (!targetId && defaultTarget) {
      setTargetId(defaultTarget)
      setParams({ to: defaultTarget }, { replace: true })
    }
  }, [defaultTarget, targetId, setParams])

  function chooseTarget(id: string) {
    setTargetId(id)
    setRevealKey((k) => k + 1)
    setParams({ to: id }, { replace: true })
    const node = getNode(id)
    if (node) setSearchQ(node.name)
    setSearchOpen(false)
  }

  const paths = useMemo(() => {
    void version
    void prefVersion
    if (!targetId) return []
    return findPaths(targetId, {
      maxDepth: isMegaSample ? 12 : 5,
      maxPaths: isMegaSample ? 3 : 5,
      minStrength: 0.35,
    })
  }, [targetId, version, prefVersion, isMegaSample])

  const verdict = bestFirstHop(paths)
  const target = getNode(targetId)
  const ask = verdict?.node ?? null
  const bestPath = verdict?.path ?? null

  useDocumentTitle(target ? `Intro to ${target.name}` : 'Find intro')

  const inDemo = isDemoMode()
  const demoReveal = inDemo && getDemoStep() >= 4 && targetId === DEMO_TARGET_ID

  return (
    <Shell active="paths">
      <div className={`find-page ${inDemo || isMegaSample ? 'find-page-demo' : ''}`} id="main-find">
        <div className="find-hero">
          {isMegaSample && networkStats && (
            <div className="mega-stats-chip find-mega-stats" role="status">
              Searching <strong>{networkStats.people.toLocaleString()}</strong> people ·{' '}
              <strong>{networkStats.edges.toLocaleString()}</strong> connections
            </div>
          )}

          <p className="eyebrow">{isMegaSample ? 'Path across 50,000 people' : inDemo ? 'The payoff' : 'Coming into focus'}</p>
          <h1>{ask ? `Ask ${ask.name}` : 'Who do you want to reach?'}</h1>
          <p className="lede">
            {isMegaSample
              ? 'Search anyone in the demo network. We trace the shortest warm path from you — try Donald Trump or any name.'
              : inDemo
                ? `One ranked first hop to ${target?.name ?? 'your target'} — every link has a public source.`
                : 'Pick someone. We’ll show the best person in your network to ask for an intro.'}
          </p>

          {!targetId && !isMegaSample ? (
            <div className="verdict">
              <strong>Build your network first</strong>
              <p>Add people you know, then come back here.</p>
              <button type="button" className="btn-primary" onClick={() => navigate('/')}>
                Open network
              </button>
            </div>
          ) : (
            <>
              <div className="field find-target-field">
                <label className="field-label" htmlFor="to">
                  {isMegaSample ? 'Search 50,000 people' : 'Person'}
                </label>
                {isMegaSample ? (
                  <div className="mega-search-wrap">
                    <input
                      id="to"
                      value={searchQ}
                      placeholder="e.g. Donald Trump, Jay Neveloff, Alex Chen…"
                      onChange={(e) => {
                        setSearchQ(e.target.value)
                        setSearchOpen(true)
                      }}
                      onFocus={() => setSearchOpen(true)}
                      onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
                      autoComplete="off"
                    />
                    {searchOpen && searchResults.length > 0 && (
                      <div className="search-results mega-search-results" role="listbox">
                        {searchResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            role="option"
                            onMouseDown={() => chooseTarget(p.id)}
                          >
                            {p.name}
                            {p.id === MEGA_TRUMP_ID && <span className="meta"> · example target</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <select
                    id="to"
                    value={targetId}
                    onChange={(e) => chooseTarget(e.target.value)}
                  >
                    {searchNodes('').map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {!ask || !bestPath ? (
                <div className="verdict">
                  <strong>No intro path yet</strong>
                  <p>
                    {isMegaSample
                      ? 'Pick someone from the search — every person in the 50k demo network is reachable from you.'
                      : 'Mark people you actually know on the network map, or add connections, then try again.'}
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
                <div className={`verdict ${inDemo || isMegaSample ? 'verdict-demo' : ''}`}>
                  <strong className="demo-ask-headline">Ask {ask.name}</strong>
                  <p>
                    Best first step toward {target?.name}.
                    {bestPath.rationale ? ` ${bestPath.rationale}` : ''}
                  </p>

                  <DemoPathChain
                    key={`${bestPath.id}-${revealKey}`}
                    path={bestPath}
                    reveal={demoReveal || isMegaSample}
                  />

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
                      onClick={() => navigate(`/?focus=${ask.id}&path=${targetId}`)}
                    >
                      See path on map
                    </button>
                  </div>
                </div>
              )}

              {paths.length > 1 && ask && ask.id !== targetId && !inDemo && !isMegaSample && (
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
