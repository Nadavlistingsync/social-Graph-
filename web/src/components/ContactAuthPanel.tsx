import { useCallback, useRef, useState } from 'react'
import { detectAndParseContacts, parsePastedContacts } from '../data/contactImport'
import { useGraph } from '../context/GraphContext'
import { pickDeviceContacts, isDevicePickerAvailable } from '../lib/deviceContacts'
import { fetchGoogleContacts } from '../lib/googleContacts'
import { fetchMicrosoftContacts } from '../lib/microsoftContacts'
import { isContactsFile, parseContactsFile } from '../lib/launchContacts'
import {
  getGoogleClientId,
  getMicrosoftClientId,
  isGoogleContactsAvailable,
  isMicrosoftContactsAvailable,
} from '../lib/oauthConfig'
import { OAuthSetupSheet } from './OAuthSetupSheet'

type ContactAuthPanelProps = {
  onSuccess?: (imported: number, skipped: number, warmthIds: string[]) => void
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
  const [loading, setLoading] = useState<'google' | 'microsoft' | 'device' | 'file' | 'paste' | null>(
    null,
  )
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    imported: number
    skipped: number
    merged: number
  } | null>(null)
  const [setupProvider, setSetupProvider] = useState<'google' | 'microsoft' | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const googleReady = isGoogleContactsAvailable()
  const microsoftReady = isMicrosoftContactsAvailable()
  const deviceReady = isDevicePickerAvailable()

  function finish(imported: number, skipped: number, merged: number, warmthIds: string[]) {
    setResult({ imported, skipped, merged })
    setLoading(null)
    onSuccess?.(imported + merged, skipped, warmthIds)
  }

  async function runImport(
    source: 'google' | 'microsoft' | 'device',
    fetcher: () => Promise<Awaited<ReturnType<typeof detectAndParseContacts>>>,
  ) {
    setError('')
    setResult(null)
    setLoading(source)
    try {
      const contacts = await fetcher()
      if (!contacts.length) {
        setError('No contacts returned. Try another option or upload a file.')
        setLoading(null)
        return
      }
      const res = importContacts(contacts)
      if (!res.ok) {
        setError(res.error)
        setLoading(null)
        return
      }
      finish(res.imported, res.skipped, res.merged, res.warmthIds)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
      setLoading(null)
    }
  }

  function handleGoogle() {
    if (!googleReady) {
      setSetupProvider('google')
      return
    }
    void runImport('google', fetchGoogleContacts)
  }

  function handleMicrosoft() {
    if (!microsoftReady) {
      setSetupProvider('microsoft')
      return
    }
    void runImport('microsoft', fetchMicrosoftContacts)
  }

  async function handleFiles(files: File[]) {
    setError('')
    setResult(null)
    setLoading('file')
    try {
      let imported = 0
      let skipped = 0
      let merged = 0
      const warmthIds: string[] = []
      let sawFile = false
      for (const file of files.filter(isContactsFile)) {
        sawFile = true
        const contacts = await parseContactsFile(file)
        if (!contacts.length) continue
        const res = importContacts(contacts)
        if (res.ok) {
          imported += res.imported
          skipped += res.skipped
          merged += res.merged
          warmthIds.push(...res.warmthIds)
        }
      }
      if (!sawFile) {
        setError('Use a .vcf (Apple) or .csv (Google / LinkedIn) file.')
        setLoading(null)
        return
      }
      if (!imported && !merged) {
        setError(
          'No contacts found in that file. For LinkedIn, upload Connections.csv from the unzipped export.',
        )
        setLoading(null)
        return
      }
      finish(imported, skipped, merged, warmthIds)
    } catch {
      setError('Could not read file')
      setLoading(null)
    }
  }

  function handlePaste() {
    setError('')
    setResult(null)
    setLoading('paste')
    const contacts = parsePastedContacts(pasteText)
    if (!contacts.length) {
      setError('Paste one name per line, optionally with an email.')
      setLoading(null)
      return
    }
    const res = importContacts(contacts)
    if (!res.ok) {
      setError(res.error)
      setLoading(null)
      return
    }
    setPasteText('')
    setPasteOpen(false)
    finish(res.imported, res.skipped, res.merged, res.warmthIds)
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      void handleFiles([...e.dataTransfer.files])
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [importContacts],
  )

  if (result) {
    return (
      <div className="import-result">
        <strong>
          Added {result.imported}
          {result.merged ? ` · merged ${result.merged}` : ''} contacts
        </strong>
        {result.skipped > 0 && (
          <p className="section-hint">Skipped {result.skipped} incomplete rows.</p>
        )}
        <p className="section-hint">Next: score how well you know them.</p>
      </div>
    )
  }

  return (
    <div
      className={`${compact ? 'contact-auth compact' : 'contact-auth'} ${dragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="auth-buttons">
        <button
          type="button"
          className="auth-btn google"
          disabled={Boolean(loading)}
          onClick={handleGoogle}
        >
          <span className="auth-icon" aria-hidden>
            G
          </span>
          {loading === 'google' ? 'Signing in…' : 'Google Contacts'}
        </button>

        {deviceReady && (
          <button
            type="button"
            className="auth-btn device"
            disabled={Boolean(loading)}
            onClick={() => runImport('device', pickDeviceContacts)}
          >
            {loading === 'device' ? 'Opening…' : 'This phone / Mac contacts'}
          </button>
        )}

        <button
          type="button"
          className="auth-btn microsoft"
          disabled={Boolean(loading)}
          onClick={handleMicrosoft}
        >
          <span className="auth-icon" aria-hidden>
            M
          </span>
          {loading === 'microsoft' ? 'Signing in…' : 'Microsoft Outlook'}
        </button>
      </div>

      <button
        type="button"
        className="auth-btn device"
        disabled={Boolean(loading)}
        onClick={() => setPasteOpen((v) => !v)}
      >
        {pasteOpen ? 'Hide paste list' : 'Paste a list of names'}
      </button>

      {pasteOpen && (
        <div className="paste-contacts">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            placeholder={'Alex Chen, alex@acme.com\nSam Rivera\nJordan Lee <jordan@example.com>'}
            aria-label="Paste contacts"
          />
          <button
            type="button"
            className="btn-primary"
            disabled={Boolean(loading) || !pasteText.trim()}
            onClick={handlePaste}
          >
            {loading === 'paste' ? 'Importing…' : 'Import pasted contacts'}
          </button>
        </div>
      )}

      <div className="auth-divider">
        <span>or upload a file</span>
      </div>

      <div
        className="drop-zone inline"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        {loading === 'file'
          ? 'Reading file…'
          : 'Apple .vcf · Google CSV · LinkedIn Connections.csv'}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".vcf,.csv,text/vcard,text/x-vcard,text/csv"
        multiple
        hidden
        onChange={(e) => {
          const list = e.target.files ? [...e.target.files] : []
          if (list.length) void handleFiles(list)
          e.target.value = ''
        }}
      />

      <details className="import-help">
        <summary>How to export</summary>
        <ul>
          <li>
            <strong>Google</strong> — tap Google Contacts above, or Contacts → Export → Google CSV.
          </li>
          <li>
            <strong>Apple</strong> — Contacts app → select All Contacts → File → Export → Export
            vCard (.vcf).
          </li>
          <li>
            <strong>LinkedIn</strong> — Settings → Data privacy → Get a copy of your data → check
            Connections → download → unzip → upload <code>Connections.csv</code>.
          </li>
        </ul>
      </details>

      <p className="section-hint auth-hint">
        Names and emails only. Stays private to you (and syncs if you’re signed in).
      </p>

      {error && <p className="form-error">{error}</p>}

      {showSkip && onSkip && (
        <button type="button" className="text-btn skip-auth" onClick={onSkip} disabled={Boolean(loading)}>
          Skip for now
        </button>
      )}

      {setupProvider && (
        <OAuthSetupSheet
          provider={setupProvider}
          onClose={() => setSetupProvider(null)}
          onSaved={() => {
            setSetupProvider(null)
            if (setupProvider === 'google') handleGoogle()
            else handleMicrosoft()
          }}
        />
      )}
    </div>
  )
}

export function contactAuthStatus(): { google: boolean; microsoft: boolean; device: boolean } {
  return {
    google: Boolean(getGoogleClientId()),
    microsoft: Boolean(getMicrosoftClientId()),
    device: isDevicePickerAvailable(),
  }
}
