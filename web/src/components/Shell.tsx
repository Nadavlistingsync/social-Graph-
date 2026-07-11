import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { NODE_TYPE_LABEL } from '../data/seed'
import { searchNodes } from '../data/paths'

const links = [
  { to: '/', label: 'Find path', id: 'paths' as const },
  { to: '/graph', label: 'Graph', id: 'graph' as const },
]

export function Shell({
  children,
  active,
}: {
  children: React.ReactNode
  active: 'graph' | 'person' | 'paths'
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const results = useMemo(() => (open && q.trim() ? searchNodes(q).slice(0, 6) : []), [q, open])
  const showResults = open && q.trim().length > 0

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Social Graph</div>
          <div className="brand-sub">Who can intro me?</div>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={active === l.id ? 'active' : undefined}
              aria-current={active === l.id ? 'page' : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="demo-notice">Illustrative public data. Verify every relationship before acting.</p>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="search-wrap">
            <input
              placeholder="Search people…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              aria-label="Search"
              aria-expanded={showResults}
              aria-controls="search-results"
            />
            {showResults && (
              <div className="search-results" id="search-results">
                {results.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onMouseDown={() => {
                      navigate(`/person/${n.id}`)
                      setQ('')
                      setOpen(false)
                    }}
                  >
                    {n.name}
                    <div className="meta">{NODE_TYPE_LABEL[n.type]}</div>
                  </button>
                ))}
                {results.length === 0 && <div className="search-empty">No matches found.</div>}
              </div>
            )}
          </div>
        </header>
        <main className="view-body" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
