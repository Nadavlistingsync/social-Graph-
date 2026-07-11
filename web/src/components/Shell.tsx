import { useId, useMemo, useState } from 'react'
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
  const [activeResult, setActiveResult] = useState(-1)
  const resultsId = useId()
  const navigate = useNavigate()
  const results = useMemo(() => (open && q.trim() ? searchNodes(q).slice(0, 6) : []), [q, open])
  const selectResult = (id: string) => {
    navigate(`/person/${id}`)
    setQ('')
    setOpen(false)
    setActiveResult(-1)
  }

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
        <nav className="nav" aria-label="Primary navigation">
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
                setActiveResult(-1)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              aria-label="Search"
              aria-autocomplete="list"
              aria-controls={resultsId}
              aria-expanded={open && Boolean(q.trim())}
              aria-activedescendant={activeResult >= 0 ? `${resultsId}-${activeResult}` : undefined}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' && results.length) {
                  event.preventDefault()
                  setActiveResult((current) => (current + 1) % results.length)
                } else if (event.key === 'ArrowUp' && results.length) {
                  event.preventDefault()
                  setActiveResult((current) => (current <= 0 ? results.length - 1 : current - 1))
                } else if (event.key === 'Enter' && activeResult >= 0) {
                  event.preventDefault()
                  selectResult(results[activeResult].id)
                } else if (event.key === 'Escape') {
                  setOpen(false)
                  setActiveResult(-1)
                }
              }}
            />
            {open && results.length > 0 && (
              <div id={resultsId} className="search-results" role="listbox">
                {results.map((n, index) => (
                  <button
                    id={`${resultsId}-${index}`}
                    key={n.id}
                    type="button"
                    role="option"
                    aria-selected={activeResult === index}
                    className={activeResult === index ? 'active' : undefined}
                    onClick={() => selectResult(n.id)}
                  >
                    {n.name}
                    <div className="meta">{NODE_TYPE_LABEL[n.type]}</div>
                  </button>
                ))}
              </div>
            )}
            {open && q.trim() && results.length === 0 && (
              <div id={resultsId} className="search-results search-empty" role="status">
                No matching people or organizations.
              </div>
            )}
          </div>
        </header>
        <main id="main-content" className="view-body">
          <p className="demo-notice">
            Demo data only — verify relationships and obtain consent before requesting an introduction.
          </p>
          {children}
        </main>
      </div>
    </div>
  )
}
