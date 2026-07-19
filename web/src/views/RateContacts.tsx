import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shell } from '../components/Shell'
import { useAuth } from '../context/AuthContext'
import { useGraph } from '../context/GraphContext'
import { usePreferences } from '../context/PreferencesContext'
import { YOU_ID } from '../data/graphStore'
import {
  applyScoreToOverride,
  contactFromNode,
  fetchAiStatus,
  rateAllContacts,
} from '../data/relationshipScore'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const REVIEW_CAP = 24

type Phase = 'scoring' | 'review' | 'done'

export function RateContacts({
  embedded = false,
  onComplete,
}: {
  embedded?: boolean
  onComplete?: () => void
}) {
  const navigate = useNavigate()
  const { nodes, profile, version } = useGraph()
  const { getWarmth, setWarmth } = usePreferences()
  const { user } = useAuth()
  const [phase, setPhase] = useState<Phase>('scoring')
  const [progress, setProgress] = useState({ done: 0, total: 0, mode: 'ai' as 'ai' | 'heuristic' })
  const [statusNote, setStatusNote] = useState('Checking AI…')
  const [queue, setQueue] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [error, setError] = useState('')
  const started = useRef(false)
  const pointer = useRef<{ x: number; active: boolean }>({ x: 0, active: false })

  useDocumentTitle('Rate contacts')

  const people = useMemo(() => {
    void version
    return nodes.filter((n) => n.id !== YOU_ID && n.type === 'person')
  }, [nodes, version])

  const currentId = queue[index]
  const current = people.find((p) => p.id === currentId)
  const warmth = current ? getWarmth(current) : null
  const suggested = warmth?.score ?? 5

  const runScoring = useCallback(async () => {
    setPhase('scoring')
    setError('')
    const inputs = people.map(contactFromNode)
    if (!inputs.length) {
      setPhase('done')
      return
    }

    const ai = await fetchAiStatus()
    setStatusNote(
      ai.configured
        ? `AI scoring with ${ai.model || 'OpenRouter'}…`
        : 'AI not configured — using smart local estimates…',
    )

    const ratings = await rateAllContacts({
      userName: profile.name || 'You',
      userEmail: user?.email ?? undefined,
      contacts: inputs,
      onProgress: (done, total, mode) => {
        setProgress({ done, total, mode })
        setStatusNote(
          mode === 'ai'
            ? `AI scoring ${done}/${total}…`
            : `Local estimates ${done}/${total}…`,
        )
      },
    })

    for (const r of ratings) {
      const existing = people.find((p) => p.id === r.id)
      const prior = existing ? getWarmth(existing) : null
      if (prior?.confirmed && prior.source === 'user') continue
      setWarmth(
        r.id,
        applyScoreToOverride(r.score, {
          reason: r.reason,
          source: r.source,
          confirmed: false,
        }),
      )
    }

    // Review highest scores first (most likely real relationships)
    const ranked = [...ratings].sort((a, b) => b.score - a.score)
    const reviewIds = ranked.slice(0, Math.min(REVIEW_CAP, ranked.length)).map((r) => r.id)
    setQueue(reviewIds)
    setIndex(0)
    setPhase(reviewIds.length ? 'review' : 'done')
  }, [getWarmth, people, profile.name, setWarmth, user?.email])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void runScoring()
  }, [runScoring])

  function commitScore(score: number, opts?: { skip?: boolean; confirmed?: boolean }) {
    if (!currentId) return
    const reason = opts?.skip
      ? 'Skipped — mark later'
      : warmth?.reason && warmth.source !== 'user'
        ? warmth.reason
        : 'You set this score'
    setWarmth(
      currentId,
      applyScoreToOverride(score, {
        reason,
        source: opts?.skip ? warmth?.source || 'user' : 'user',
        confirmed: opts?.confirmed ?? !opts?.skip,
      }),
    )
    const next = index + 1
    if (next >= queue.length) setPhase('done')
    else setIndex(next)
    setDragX(0)
  }

  function onPointerDown(clientX: number) {
    pointer.current = { x: clientX, active: true }
  }
  function onPointerMove(clientX: number) {
    if (!pointer.current.active) return
    setDragX(clientX - pointer.current.x)
  }
  function onPointerUp() {
    if (!pointer.current.active) return
    pointer.current.active = false
    if (dragX > 90) commitScore(suggested, { confirmed: true })
    else if (dragX < -90) commitScore(Math.min(suggested, 2), { skip: true, confirmed: true })
    else setDragX(0)
  }

  function finishToMap(path = '/') {
    onComplete?.()
    navigate(path)
  }

  const body = (
    <div className={`rate-flow ${embedded ? 'embedded' : ''}`} id={embedded ? 'main' : undefined}>
      {phase === 'scoring' && (
        <div className="rate-scoring">
          <div className="brand-mark">Social Graph</div>
          <h1>Scoring your network</h1>
          <p className="lede">{statusNote}</p>
          <div className="rate-progress" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total || 1}>
            <div
              className="rate-progress-bar"
              style={{ width: `${progress.total ? (100 * progress.done) / progress.total : 8}%` }}
            />
          </div>
          <p className="section-hint">
            {progress.total
              ? `${progress.done} of ${progress.total}`
              : 'Preparing…'}
          </p>
          {error && <p className="form-error">{error}</p>}
        </div>
      )}

      {phase === 'review' && current && (
        <div className="rate-review">
          <div className="rate-review-head">
            <p className="section-hint" style={{ margin: 0 }}>
              Quick check · {index + 1}/{queue.length}
            </p>
            <button type="button" className="text-btn" onClick={() => finishToMap('/')}>
              Skip to map
            </button>
          </div>
          <h1>How well do you know them?</h1>
          <p className="lede">Swipe right to accept · left if you barely know them · or tap 1–10</p>

          <div
            className="rate-card"
            style={{
              transform: `translateX(${dragX}px) rotate(${dragX / 28}deg)`,
              borderColor: dragX > 40 ? '#0a6b52' : dragX < -40 ? '#a65d4a' : undefined,
            }}
            onPointerDown={(e) => {
              ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
              onPointerDown(e.clientX)
            }}
            onPointerMove={(e) => onPointerMove(e.clientX)}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              pointer.current.active = false
              setDragX(0)
            }}
          >
            <div className="rate-card-score">{suggested}</div>
            <h2 className="rate-card-name">{current.name}</h2>
            <p className="rate-card-meta">{current.summary}</p>
            {warmth?.reason && <p className="rate-card-reason">{warmth.reason}</p>}
            <div className="rate-swipe-hints">
              <span>← Barely</span>
              <span>Know them →</span>
            </div>
          </div>

          <div className="rate-scale" role="group" aria-label="Score 1 to 10">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`rate-scale-btn ${n === suggested ? 'on' : ''}`}
                onClick={() => commitScore(n, { confirmed: true })}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="rate-done">
          <div className="brand-mark">Social Graph</div>
          <h1>Your map is ready</h1>
          <p className="lede">
            {people.length
              ? `${people.length} people scored. Open the network, then find paths to anyone.`
              : 'Import contacts anytime from the Contacts button.'}
          </p>
          {profile.targetPerson && (
            <p className="section-hint">
              Looking for <strong>{profile.targetPerson}</strong>? Try Find intro next.
            </p>
          )}
          <div className="rate-done-actions">
            <button type="button" className="btn-primary" onClick={() => finishToMap('/')}>
              See my network
            </button>
            {profile.targetPerson && (
              <button type="button" className="btn-quiet" onClick={() => finishToMap('/find')}>
                Find path to {profile.targetPerson.split(' ')[0]}
              </button>
            )}
            <button type="button" className="text-btn" onClick={() => void runScoring()}>
              Re-score with AI
            </button>
          </div>
        </div>
      )}
    </div>
  )

  if (embedded) return body
  return <Shell active="settings">{body}</Shell>
}
