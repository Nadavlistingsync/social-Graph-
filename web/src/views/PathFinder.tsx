import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { bestFirstHop, findPaths, getNode } from '../data/paths'
import { Shell } from '../components/Shell'
import { useGraph } from '../context/GraphContext'
import { useContactImport } from '../context/ContactImportContext'
import { usePreferences } from '../context/PreferencesContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function PathFinder() {
  const { version, youId, nodes, profile, addPerson } = useGraph()
  const { openImport } = useContactImport()
  const { version: prefVersion, setWarmth } = usePreferences()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const people = useMemo(() => {
    void version
    return nodes.filter((n) => n.type === 'person' && n.id !== youId)
  }, [nodes, youId, version])

  const intentName = profile.targetPerson?.trim() || ''
  const intentMatch = useMemo(() => {
    if (!intentName) return null
    const needle = normalizeName(intentName)
    return (
      people.find((p) => normalizeName(p.name) === needle) ||
      people.find((p) => normalizeName(p.name).includes(needle) || needle.includes(normalizeName(p.name))) ||
      null
    )
  }, [people, intentName])

  const defaultTarget =
    intentMatch?.id ||
    (profile.loadSample && people.some((p) => p.id === 'donald-trump')
      ? 'donald-trump'
      : people[0]?.id ?? '')
  const paramTarget = params.get('to')
  const initial =
    paramTarget && people.some((p) => p.id === paramTarget) ? paramTarget : defaultTarget
  const [targetId, setTargetId] = useState(initial)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    const next = params.get('to')
    if (next && people.some((p) => p.id === next) && next !== targetId) {
      setTargetId(next)
      return
    }
    // Wire onboarding target → Find when no explicit ?to=
    if (!next && intentMatch && intentMatch.id !== targetId) {
      setTargetId(intentMatch.id)
      setParams({ to: intentMatch.id }, { replace: true })
    }
  }, [params, people, targetId, intentMatch, setParams])

  function chooseTarget(id: string) {
    setTargetId(id)
    setParams(id ? { to: id } : {}, { replace: true })
  }

  function addTargetPerson() {
    if (!intentName) return
    setAddError(null)
    const result = addPerson({
      name: intentName,
      summary: 'Target from setup — add connections to find an intro path.',
      knownByUser: false,
      connectToId: null,
    })
    if (!result.ok) {
      setAddError(result.error)
      return
    }
    setWarmth(result.id, { knownByUser: false, warmth: 0.2 })
    chooseTarget(result.id)
  }

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
            Pick someone. We’ll show the best person in your network to ask for an intro.
          </p>

          {people.length === 0 ? (
            <div className="verdict">
              <strong>Build your network first</strong>
              <p>
                {intentName
                  ? `Import or add people you know, then we’ll look for a path to ${intentName}.`
                  : 'Import contacts or add people you know, then come back here.'}
              </p>
              <div className="panel-actions">
                <button type="button" className="btn-primary" onClick={openImport}>
                  Import contacts
                </button>
                <button type="button" className="btn-quiet" onClick={() => navigate('/')}>
                  Open network
                </button>
              </div>
              {intentName && (
                <button type="button" className="text-btn" onClick={addTargetPerson}>
                  Add {intentName} as a target
                </button>
              )}
              {addError && <p className="form-error">{addError}</p>}
            </div>
          ) : (
            <>
              {intentName && !intentMatch && (
                <div className="verdict" style={{ marginBottom: '1rem' }}>
                  <strong>{intentName} isn’t in your map yet</strong>
                  <p>Add them as a target, then connect people who might know them.</p>
                  <button type="button" className="btn-primary" onClick={addTargetPerson}>
                    Add {intentName}
                  </button>
                  {addError && <p className="form-error">{addError}</p>}
                </div>
              )}

              <div className="field">
                <label className="field-label" htmlFor="to">
                  Person
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

              {!ask || !bestPath ? (
                <div className="verdict">
                  <strong>No intro path yet</strong>
                  <p>
                    Mark people you actually know on the network map, or add connections, then try
                    again.
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
