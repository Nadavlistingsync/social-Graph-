import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AccountPanel } from '../components/AccountPanel'
import { Shell } from '../components/Shell'
import { contactAuthStatus } from '../components/ContactAuthPanel'
import { useContactImport } from '../context/ContactImportContext'
import { useGraph } from '../context/GraphContext'
import { usePreferences } from '../context/PreferencesContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  getOAuthUserConfig,
  saveOAuthUserConfig,
} from '../lib/oauthConfig'

export function Settings() {
  const { profile, updateProfile, setLoadSample, resetAll } = useGraph()
  const { openImport } = useContactImport()
  const { exportData, importData } = usePreferences()
  const [name, setName] = useState(profile.name)
  const [summary, setSummary] = useState(profile.summary)
  const oauth = getOAuthUserConfig()
  const [googleClientId, setGoogleClientId] = useState(oauth.googleClientId ?? '')
  const [microsoftClientId, setMicrosoftClientId] = useState(oauth.microsoftClientId ?? '')
  const authStatus = contactAuthStatus()

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
        <p className="lede">
          Sign in to sync across devices. A local copy stays in this browser; export a backup anytime.
        </p>

        <section className="note-section">
          <h2>Account &amp; sync</h2>
          <AccountPanel />
        </section>

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
          <h2>Contact sign-in</h2>
          <p className="section-hint">
            One-click Google and Microsoft import needs OAuth Client IDs. Your deployer can set env
            vars, or paste your own below (stored only in this browser).
          </p>
          <div className="auth-status">
            <span className={authStatus.google ? 'on' : ''}>
              Google {authStatus.google ? 'ready' : 'not configured'}
            </span>
            <span className={authStatus.microsoft ? 'on' : ''}>
              Microsoft {authStatus.microsoft ? 'ready' : 'not configured'}
            </span>
            {authStatus.device && <span className="on">Device picker available</span>}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveOAuthUserConfig({
                googleClientId: googleClientId.trim() || undefined,
                microsoftClientId: microsoftClientId.trim() || undefined,
              })
              window.location.reload()
            }}
          >
            <div className="field">
              <label className="field-label" htmlFor="google-client-id">
                Google OAuth Client ID
              </label>
              <input
                id="google-client-id"
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
                placeholder="….apps.googleusercontent.com"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="ms-client-id">
                Microsoft / Azure Client ID
              </label>
              <input
                id="ms-client-id"
                value={microsoftClientId}
                onChange={(e) => setMicrosoftClientId(e.target.value)}
                placeholder="Azure app (application) ID"
              />
            </div>
            <button type="submit" className="chip on">
              Save sign-in keys
            </button>
          </form>
        </section>

        <section className="note-section">
          <h2>Import contacts</h2>
          <p className="section-hint">
            Bring in people from Google, Microsoft Outlook, your phone, or an Apple vCard export.
          </p>
          <button type="button" className="chip on" onClick={openImport}>
            Connect address book
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
          <Link to="/">← Back to network</Link>
        </p>
      </div>
    </Shell>
  )
}
