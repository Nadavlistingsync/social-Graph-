import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { NODE_TYPE_LABEL, nodes } from '../data/seed'
import { searchNodes } from '../data/paths'

const links = [
  { to: '/', label: 'Graph' },
  { to: '/person/donald-trump', label: 'Person' },
  { to: '/paths', label: 'Path Finder' },
]

const GUIDE_KEY = 'sg-guide-seen'

function WelcomeGuide({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="guide-overlay" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="guide-backdrop" onClick={onClose} />
      <div className="guide-card">
        <div className="guide-kicker">Warm intro network</div>
        <h2 className="guide-title">
          Who is the best person I know who can credibly get me to a target?
        </h2>
        <p className="guide-lede">
          Social Graph maps the public relationships around anyone, then ranks the warmest,
          most credible path from your network to them — with evidence on every hop.
        </p>
        <ol className="guide-steps">
          <li>
            <strong>Graph</strong> — explore the network as typed, cited relationships.
          </li>
          <li>
            <strong>Person</strong> — read any node like a note: claims, citations, private notes.
          </li>
          <li>
            <strong>Path Finder</strong> — get ranked intro paths and the best first ask.
          </li>
        </ol>
        <div className="guide-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              navigate('/paths?to=donald-trump')
              onClose()
            }}
          >
            Show me the path to Donald Trump
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => {
              navigate('/')
              onClose()
            }}
          >
            Explore the graph
          </button>
        </div>
        <button type="button" className="guide-dismiss" onClick={onClose} aria-label="Close">
          Skip intro
        </button>
      </div>
    </div>
  )
}

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
  const [showGuide, setShowGuide] = useState(() => {
    try {
      return !localStorage.getItem(GUIDE_KEY)
    } catch {
      return true
    }
  })

  function closeGuide() {
    setShowGuide(false)
    try {
      localStorage.setItem(GUIDE_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="app-shell">
      {showGuide && <WelcomeGuide onClose={closeGuide} />}
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
          <button type="button" className="chip" onClick={() => setShowGuide(true)}>
            Guide
          </button>
        </header>
        <div className="view-body">{children}</div>
      </div>
    </div>
  )
}
