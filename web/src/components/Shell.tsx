import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { NODE_TYPE_LABEL } from '../data/seed'
import { searchNodes } from '../data/paths'
import { useAuth } from '../context/AuthContext'
import { useGraph } from '../context/GraphContext'
import { useContactImport } from '../context/ContactImportContext'
import { AddPersonModal } from './GraphModals'

const tabs = [
  { to: '/', label: 'Network', id: 'graph' as const },
  { to: '/find', label: 'Find', id: 'paths' as const },
  { to: '/settings', label: 'Settings', id: 'settings' as const },
]

export function Shell({
  children,
  active,
}: {
  children: React.ReactNode
  active: 'graph' | 'person' | 'paths' | 'settings'
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const { openImport } = useContactImport()
  const navigate = useNavigate()
  const { profile, version } = useGraph()
  const { user, syncStatus } = useAuth()
  const results = useMemo(() => {
    void version
    return open && q.trim() ? searchNodes(q).slice(0, 6) : []
  }, [q, open, version])

  function pickResult(id: string) {
    navigate(`/person/${id}`)
    setQ('')
    setOpen(false)
    setHighlight(0)
  }

  return (
    <div className="app-shell">
      <header className="top-chrome">
        <Link to="/" className="brand brand-link">
          <span className="brand-mark">Social Graph</span>
          <span className="brand-sub">
            {profile.name ? profile.name.split(' ')[0] : 'Your map'}
          </span>
        </Link>

        <nav className="nav-desktop" aria-label="Main">
          {tabs.map((t) => (
            <Link key={t.to} to={t.to} className={active === t.id ? 'active' : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="chrome-actions">
          <div className="search-wrap">
            <input
              placeholder="Search…"
              value={q}
              role="combobox"
              aria-expanded={open && results.length > 0}
              aria-controls="search-results"
              aria-autocomplete="list"
              aria-activedescendant={results.length ? `search-option-${highlight}` : undefined}
              onChange={(e) => {
                setQ(e.target.value)
                setOpen(true)
                setHighlight(0)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => {
                if (!results.length) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setHighlight((h) => (h + 1) % results.length)
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setHighlight((h) => (h - 1 + results.length) % results.length)
                } else if (e.key === 'Enter' && results[highlight]) {
                  e.preventDefault()
                  pickResult(results[highlight].id)
                } else if (e.key === 'Escape') {
                  setOpen(false)
                }
              }}
              aria-label="Search people"
            />
            {open && results.length > 0 && (
              <div className="search-results" id="search-results" role="listbox">
                {results.map((n, i) => (
                  <button
                    key={n.id}
                    id={`search-option-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    className={i === highlight ? 'highlighted' : undefined}
                    onMouseDown={() => pickResult(n.id)}
                  >
                    {n.name}
                    <div className="meta">{NODE_TYPE_LABEL[n.type]}</div>
                  </button>
                ))}
              </div>
            )}
            {open && q.trim() && results.length === 0 && (
              <div className="search-results search-empty" role="status">
                No matches
              </div>
            )}
          </div>
          <button type="button" className="btn-quiet desktop-only" onClick={openImport}>
            Contacts
          </button>
          <Link to="/settings" className="btn-quiet desktop-only account-chip">
            {user ? (syncStatus === 'synced' ? 'Synced' : user.email?.split('@')[0] || 'Account') : 'Account'}
          </Link>
          <button type="button" className="btn-primary chrome-add" onClick={() => setAddOpen(true)}>
            Add
          </button>
        </div>
      </header>

      <div className="main">
        <div className="view-body" id="main">
          {children}
        </div>
      </div>

      <nav className="bottom-nav" aria-label="Primary">
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} className={active === t.id ? 'active' : undefined}>
            {t.label}
          </Link>
        ))}
        <button type="button" className="bottom-add" onClick={() => setAddOpen(true)}>
          Add
        </button>
      </nav>

      <AddPersonModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
