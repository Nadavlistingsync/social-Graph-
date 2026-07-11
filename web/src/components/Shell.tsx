import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { NODE_TYPE_LABEL } from '../data/seed'
import { searchNodes } from '../data/paths'
import { useGraph } from '../context/GraphContext'
import { usePreferences } from '../context/PreferencesContext'
import { AddPersonModal } from './GraphModals'
import { ImportContactsModal } from './ImportContactsModal'

const links = [
  { to: '/', label: 'Find path', id: 'paths' as const },
  { to: '/graph', label: 'Graph', id: 'graph' as const },
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
  const [importOpen, setImportOpen] = useState(false)
  const navigate = useNavigate()
  const importRef = useRef<HTMLInputElement>(null)
  const { profile, version } = useGraph()
  const { exportData, importData } = usePreferences()
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

  function handleExport() {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `social-graph-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(file: File) {
    file.text().then((raw) => {
      const result = importData(raw)
      if (!result.ok) window.alert(result.error)
      else window.location.reload()
    })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Social Graph</div>
          <div className="brand-sub">{profile.name ? `Hi, ${profile.name.split(' ')[0]}` : 'Who can intro me?'}</div>
        </div>
        <nav className="nav" aria-label="Main">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={active === l.id ? 'active' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="text-btn" onClick={() => setImportOpen(true)}>
            Import contacts
          </button>
          <button type="button" className="text-btn" onClick={() => setAddOpen(true)}>
            + Add person
          </button>
          <Link to="/settings" className="text-btn">
            Settings
          </Link>
          <button type="button" className="text-btn" onClick={handleExport}>
            Export data
          </button>
          <button type="button" className="text-btn" onClick={() => importRef.current?.click()}>
            Import data
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImport(file)
              e.target.value = ''
            }}
          />
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="search-wrap">
            <input
              placeholder="Search people…"
              value={q}
              role="combobox"
              aria-expanded={open && results.length > 0}
              aria-controls="search-results"
              aria-autocomplete="list"
              aria-activedescendant={
                results.length ? `search-option-${highlight}` : undefined
              }
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
          <button type="button" className="chip on topbar-add" onClick={() => setAddOpen(true)}>
            + Add person
          </button>
        </header>
        <div className="view-body">{children}</div>
        <footer className="app-footer">
          Your graph stays in this browser. Export a backup from Settings before switching devices.
        </footer>
      </div>
      <AddPersonModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ImportContactsModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
