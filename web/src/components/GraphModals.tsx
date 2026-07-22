import { useState } from 'react'
import { EDGE_TYPES } from '../data/seed'
import { useGraph } from '../context/GraphContext'
import { usePreferences } from '../context/PreferencesContext'

export function AddPersonModal({
  open,
  onClose,
  connectToId,
}: {
  open: boolean
  onClose: () => void
  connectToId?: string
}) {
  const { addPerson } = useGraph()
  const { setWarmth } = usePreferences()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [justAdded, setJustAdded] = useState<string[]>([])

  if (!open) return null

  function reset() {
    setName('')
    setError('')
    setJustAdded([])
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const result = addPerson({
      name: trimmed,
      summary: '',
      connectToId,
      knownByUser: true,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setWarmth(result.id, { knownByUser: true, warmth: 0.8 })
    setJustAdded((prev) => [...prev, trimmed])
    setName('')
    setError('')
  }

  function done() {
    reset()
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={done} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-labelledby="add-person-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-person-title">Add people</h2>
        <p className="section-hint">Type a name and hit Enter. Keep going — then Done.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label className="field-label" htmlFor="person-name">
              Name
            </label>
            <input
              id="person-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Chen"
              autoFocus
              autoComplete="off"
            />
          </div>
          {justAdded.length > 0 && (
            <p className="add-people-trail" aria-live="polite">
              Added {justAdded.slice(-5).join(' · ')}
              {justAdded.length > 5 ? ` · +${justAdded.length - 5} more` : ''}
            </p>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="chip" onClick={done}>
              Done
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: 'auto' }}
              disabled={!name.trim()}
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AddConnectionModal({
  open,
  onClose,
  fromId,
  fromName,
}: {
  open: boolean
  onClose: () => void
  fromId: string
  fromName: string
}) {
  const { nodes, youId, addConnection } = useGraph()
  const [toId, setToId] = useState('')
  const [type, setType] = useState<(typeof EDGE_TYPES)[number]>('partner')
  const [explanation, setExplanation] = useState('')
  const [strength, setStrength] = useState(0.75)
  const [error, setError] = useState('')

  const options = nodes.filter((n) => n.id !== fromId)

  if (!open) return null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!toId) {
      setError('Pick someone to connect to')
      return
    }
    const result = addConnection({ fromId, toId, type, explanation, strength })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setToId('')
    setExplanation('')
    setError('')
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-labelledby="add-connection-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-connection-title">Add connection</h2>
        <p className="section-hint">From {fromName}</p>
        <form onSubmit={submit}>
          <div className="field">
            <label className="field-label" htmlFor="conn-to">
              Connect to
            </label>
            <select id="conn-to" value={toId} onChange={(e) => setToId(e.target.value)} required>
              <option value="">Select…</option>
              {options.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                  {n.id === youId ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="conn-type">
              Relationship
            </label>
            <select
              id="conn-type"
              value={type}
              onChange={(e) => setType(e.target.value as (typeof EDGE_TYPES)[number])}
            >
              {EDGE_TYPES.filter((t) => t !== 'weak public mention').map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="conn-explanation">
              Why this link exists
            </label>
            <input
              id="conn-explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="e.g. Met through a conference, worked together…"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="conn-strength">
              Strength {Math.round(strength * 100)}%
            </label>
            <input
              id="conn-strength"
              type="range"
              min={0.35}
              max={1}
              step={0.05}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="chip" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ width: 'auto' }}>
              Add connection
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
