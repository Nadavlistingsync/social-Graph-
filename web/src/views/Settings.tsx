import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Shell } from '../components/Shell'
import { ImportContactsModal } from '../components/ImportContactsModal'
import { useGraph } from '../context/GraphContext'
import { usePreferences } from '../context/PreferencesContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function Settings() {
  const { profile, updateProfile, setLoadSample, resetAll } = useGraph()
  const { exportData, importData } = usePreferences()
  const [name, setName] = useState(profile.name)
  const [summary, setSummary] = useState(profile.summary)
  const [importOpen, setImportOpen] = useState(false)

  useDocumentTitle('Settings')

  function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    updateProfile({ name: name.trim() || profile.name, summary: summary.trim() })
  }

  function handleImport(file: File) {
    file.text().then((raw) => {
      const result = importData(raw)
      if (!result.ok) window.alert(result.error)
      else window.location.reload()
    })
  }

  function handleReset() {
    if (
      window.confirm(
        'Reset everything? This clears your graph, warmth, notes, and awkward-intro flags.',
      )
    ) {
      resetAll()
      window.location.reload()
    }
  }

  return (
    <Shell active="settings">
      <div className="settings-page" id="main">
        <h1>Settings</h1>
        <p className="lede">Your graph lives in this browser. Export a backup before switching devices.</p>

        <section className="note-section">
          <h2>Your profile</h2>
          <form onSubmit={saveProfile}>
            <div className="field">
              <label className="field-label" htmlFor="settings-name">
                Name
              </label>
              <input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="settings-summary">
                About you
              </label>
              <textarea
                id="settings-summary"
                className="notes-box"
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" style={{ width: 'auto' }}>
              Save profile
            </button>
          </form>
        </section>

        <section className="note-section">
          <h2>Sample network</h2>
          <p className="section-hint">
            Toggle the public demo graph on or off. Your own people and connections are always kept.
          </p>
          <label className="warmth-toggle">
            <input
              type="checkbox"
              checked={profile.loadSample}
              onChange={(e) => setLoadSample(e.target.checked)}
            />
            Show sample network
          </label>
        </section>

        <section className="note-section">
          <h2>Import contacts</h2>
          <p className="section-hint">
            Bring in people from Apple Contacts (vCard), Gmail (CSV or Google sign-in), or Outlook.
          </p>
          <button type="button" className="chip on" onClick={() => setImportOpen(true)}>
            Import from address book
          </button>
        </section>

        <section className="note-section">
          <h2>Backup</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="chip on"
              onClick={() => {
                const blob = new Blob([exportData()], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `social-graph-backup-${new Date().toISOString().slice(0, 10)}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              Export data
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'application/json,.json'
                input.onchange = () => {
                  const file = input.files?.[0]
                  if (file) handleImport(file)
                }
                input.click()
              }}
            >
              Import data
            </button>
          </div>
        </section>

        <section className="note-section">
          <h2>Reset</h2>
          <button type="button" className="chip" onClick={handleReset}>
            Clear all data and start over
          </button>
        </section>

        <p style={{ marginTop: '2rem' }}>
          <Link to="/">← Back to path finder</Link>
        </p>
      </div>
      <ImportContactsModal open={importOpen} onClose={() => setImportOpen(false)} />
    </Shell>
  )
}
