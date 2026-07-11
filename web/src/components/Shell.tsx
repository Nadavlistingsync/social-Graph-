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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Social Graph</div>
          <div className="brand-sub">Who can intro me?</div>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={active === l.id ? 'active' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
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
            />
            {open && q.trim() && (
              <div className="search-results">
                {results.length > 0 ? (
                  results.map((n) => (
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
                  ))
                ) : (
                  <div className="search-empty">No matches for “{q.trim()}”</div>
                )}
              </div>
            )}
          </div>
        </header>
        <div className="view-body">{children}</div>
      </div>
    </div>
  )
}
