import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { NODE_TYPE_LABEL, nodes } from '../data/seed'
import { searchNodes } from '../data/paths'

const links = [
  { to: '/', label: 'Graph' },
  { to: '/person/donald-trump', label: 'Person' },
  { to: '/paths', label: 'Path Finder' },
]

export function Shell({
  children,
  title,
  active,
}: {
  children: React.ReactNode
  title: string
  active: 'graph' | 'person' | 'paths'
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const results = useMemo(() => (open ? searchNodes(q).slice(0, 8) : []), [q, open])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Social Graph</div>
          <div className="brand-sub">Warm intro network</div>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={
                (active === 'graph' && l.to === '/') ||
                (active === 'paths' && l.to === '/paths') ||
                (active === 'person' && l.label === 'Person')
                  ? 'active'
                  : undefined
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          Every edge needs evidence.
          <br />
          Access is manual. Structure is automatic.
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="search-wrap">
            <input
              placeholder="Jump to a person, company, deal…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              aria-label="Search nodes"
            />
            {open && results.length > 0 && (
              <div className="search-results">
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
              </div>
            )}
          </div>
          <span className="topbar-title" style={{ marginLeft: 'auto' }}>
            {nodes.filter((n) => n.knownByUser).length} warm contacts
          </span>
        </header>
        <div className="view-body">{children}</div>
      </div>
    </div>
  )
}
