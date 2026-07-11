import { useRef, useState } from 'react'
import { detectAndParseContacts } from '../data/contactImport'
import { useGraph } from '../context/GraphContext'
import { pickDeviceContacts, isDevicePickerAvailable } from '../lib/deviceContacts'
import { fetchGoogleContacts } from '../lib/googleContacts'
import { fetchMicrosoftContacts } from '../lib/microsoftContacts'
import {
  getGoogleClientId,
  getMicrosoftClientId,
  isGoogleContactsAvailable,
  isMicrosoftContactsAvailable,
} from '../lib/oauthConfig'

type ContactAuthPanelProps = {
  onSuccess?: (imported: number, skipped: number) => void
  onSkip?: () => void
  showSkip?: boolean
  compact?: boolean
}

export function ContactAuthPanel({
  onSuccess,
  onSkip,
  showSkip = false,
  compact = false,
}: ContactAuthPanelProps) {
  const { importContacts } = useGraph()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState<'google' | 'microsoft' | 'device' | 'file' | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)

  const googleReady = isGoogleContactsAvailable()
  const microsoftReady = isMicrosoftContactsAvailable()
  const deviceReady = isDevicePickerAvailable()

  function finish(imported: number, skipped: number) {
    setResult({ imported, skipped })
    setLoading(null)
    onSuccess?.(imported, skipped)
  }

  async function runImport(
    source: 'google' | 'microsoft' | 'device',
    fetcher: () => Promise<ReturnType<typeof detectAndParseContacts>>,
  ) {
    setError('')
    setResult(null)
    setLoading(source)
    try {
      const contacts = await fetcher()
      if (!contacts.length) {
        setError('No contacts returned. Try another sign-in option.')
        setLoading(null)
        return
      }
      const res = importContacts(contacts)
      if (!res.ok) {
        setError(res.error)
        setLoading(null)
        return
      }
      finish(res.imported, res.skipped)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
      setLoading(null)
    }
  }

  function handleFile(file: File) {
    setError('')
    setResult(null)
    setLoading('file')
    file
      .text()
      .then((raw) => {
        const contacts = detectAndParseContacts(raw, file.name)
        if (!contacts.length) {
          setError('No contacts found in that file.')
          setLoading(null)
          return
        }
        const res = importContacts(contacts)
        if (!res.ok) {
          setError(res.error)
          setLoading(null)
          return
        }
        finish(res.imported, res.skipped)
      })
      .catch(() => {
        setError('Could not read file')
        setLoading(null)
      })
  }

  if (result) {
    return (
      <div className="import-result">
        <strong>Imported {result.imported} contacts</strong>
        {result.skipped > 0 && (
          <p className="section-hint">Skipped {result.skipped} duplicates already in your graph.</p>
        )}
      </div>
    )
  }

  return (
    <div className={compact ? 'contact-auth compact' : 'contact-auth'}>
      <div className="auth-buttons">
        <button
          type="button"
          className="auth-btn google"
          disabled={Boolean(loading)}
          onClick={() => runImport('google', fetchGoogleContacts)}
        >
          <span className="auth-icon" aria-hidden>
            G
          </span>
          {loading === 'google' ? 'Signing in…' : 'Continue with Google'}
        </button>

        <button
          type="button"
          className="auth-btn microsoft"
          disabled={Boolean(loading)}
          onClick={() => runImport('microsoft', fetchMicrosoftContacts)}
        >
          <span className="auth-icon" aria-hidden>
            M
          </span>
          {loading === 'microsoft' ? 'Signing in…' : 'Continue with Microsoft'}
        </button>

        {deviceReady && (
          <button
            type="button"
            className="auth-btn device"
            disabled={Boolean(loading)}
            onClick={() => runImport('device', pickDeviceContacts)}
          >
            {loading === 'device' ? 'Opening…' : 'Pick from this device'}
          </button>
        )}
      </div>

      {!googleReady || !microsoftReady ? (
        <p className="section-hint auth-hint">
          {!googleReady && !microsoftReady
            ? 'Add Google and/or Microsoft Client IDs in Settings to enable one-click sign-in.'
            : !googleReady
              ? 'Add a Google Client ID in Settings to enable Google sign-in.'
              : 'Add a Microsoft Client ID in Settings to enable Outlook sign-in.'}
        </p>
      ) : (
        <p className="section-hint auth-hint">
          One tap — we only read names and emails. Nothing leaves your browser except the OAuth
          request to Google or Microsoft.
        </p>
      )}

      <details className="import-help">
        <summary>Other options (Apple export, CSV)</summary>
        <button
          type="button"
          className="chip"
          disabled={Boolean(loading)}
          onClick={() => fileRef.current?.click()}
        >
          {loading === 'file' ? 'Reading file…' : 'Upload vCard or CSV'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".vcf,.csv,text/vcard,text/x-vcard,text/csv"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
        <ul>
          <li>
            <strong>Apple Contacts:</strong> export vCard on Mac or iCloud.com, then upload here.
          </li>
          <li>
            <strong>Gmail users:</strong> use Continue with Google above (syncs Google Contacts).
          </li>
        </ul>
      </details>

      {error && <p className="form-error">{error}</p>}

      {showSkip && onSkip && (
        <button type="button" className="text-btn skip-auth" onClick={onSkip} disabled={Boolean(loading)}>
          Skip for now
        </button>
      )}
    </div>
  )
}

/** For Settings: show which providers are configured */
export function contactAuthStatus(): { google: boolean; microsoft: boolean; device: boolean } {
  return {
    google: Boolean(getGoogleClientId()),
    microsoft: Boolean(getMicrosoftClientId()),
    device: isDevicePickerAvailable(),
  }
}
