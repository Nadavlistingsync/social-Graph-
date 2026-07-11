import { useState } from 'react'
import { saveOAuthUserConfig } from '../lib/oauthConfig'

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://social-graph-one.vercel.app'

export function OAuthSetupSheet({
  provider,
  onClose,
  onSaved,
}: {
  provider: 'google' | 'microsoft'
  onClose: () => void
  onSaved: () => void
}) {
  const [clientId, setClientId] = useState('')
  const [copied, setCopied] = useState(false)

  const isGoogle = provider === 'google'
  const title = isGoogle ? 'Google Contacts setup' : 'Microsoft Outlook setup'

  function copyOrigin() {
    void navigator.clipboard.writeText(ORIGIN).then(() => setCopied(true))
  }

  function save() {
    const trimmed = clientId.trim()
    if (!trimmed) return
    saveOAuthUserConfig(
      isGoogle ? { googleClientId: trimmed } : { microsoftClientId: trimmed },
    )
    onSaved()
  }

  return (
    <div className="setup-sheet" role="dialog" aria-labelledby="oauth-setup-title">
      <h3 id="oauth-setup-title">{title}</h3>
      <p className="section-hint">One-time, 30 seconds. Stored only in this browser.</p>

      <ol className="setup-steps">
        <li>
          <button type="button" className="chip" onClick={copyOrigin}>
            {copied ? 'Copied!' : 'Copy site URL'}
          </button>
          <span className="mono-hint">{ORIGIN}</span>
        </li>
        <li>
          {isGoogle ? (
            <>
              Open{' '}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
                Google Cloud Credentials
              </a>
              {' → Create OAuth client (Web) → paste URL above as Authorized JavaScript origin → enable People API'}
            </>
          ) : (
            <>
              Open{' '}
              <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noreferrer">
                Azure App registrations
              </a>
              {' → New registration → SPA → redirect URI = site URL → API permission Contacts.Read'}
            </>
          )}
        </li>
        <li>Paste the Client ID below and save.</li>
      </ol>

      <div className="field">
        <label className="field-label" htmlFor="oauth-client-id">
          Client ID
        </label>
        <input
          id="oauth-client-id"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder={isGoogle ? '….apps.googleusercontent.com' : 'Azure application ID'}
          autoFocus
        />
      </div>

      <div className="modal-actions">
        <button type="button" className="chip" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={save} disabled={!clientId.trim()}>
          Save &amp; connect
        </button>
      </div>
    </div>
  )
}
