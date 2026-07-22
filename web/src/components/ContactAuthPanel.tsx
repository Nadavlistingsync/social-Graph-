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

type ContactAuthPanelProps = {
  onSuccess?: (imported: number, skipped: number, warmthIds: string[]) => void
  onSkip?: () => void
  showSkip?: boolean
  compact?: boolean
}

type FileKind = 'google' | 'microsoft' | 'apple' | 'linkedin' | 'any'

const FILE_ACCEPT: Record<FileKind, string> = {
  google: '.csv,text/csv',
  microsoft: '.csv,text/csv',
  apple: '.vcf,text/vcard,text/x-vcard',
  linkedin: '.csv,text/csv',
  any: '.vcf,.csv,text/vcard,text/x-vcard,text/csv',
}

const FILE_HINT: Record<FileKind, string> = {
  google: 'Google Contacts → Export → Google CSV, then pick that file.',
  microsoft: 'Outlook → File → Open & Export → Export to a file → Comma Separated Values.',
  apple: 'Contacts app → select All Contacts → File → Export → Export vCard (.vcf).',
  linkedin:
    'LinkedIn → Settings → Data privacy → Get a copy of your data → Connections → upload Connections.csv.',
  any: 'Use a .vcf (Apple) or .csv (Google / LinkedIn / Outlook) file.',
}

export function ContactAuthPanel({
  onSuccess,
  onSkip,
  showSkip = false,
  compact = false,
}: ContactAuthPanelProps) {
  const { importContacts } = useGraph()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState<
    'google' | 'microsoft' | 'apple' | 'linkedin' | 'device' | 'file' | 'paste' | null
  >(null)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [result, setResult] = useState<{
    imported: number
    skipped: number
    merged: number
  } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [fileKind, setFileKind] = useState<FileKind>('any')

  const googleReady = isGoogleContactsAvailable()
  const microsoftReady = isMicrosoftContactsAvailable()
  const deviceReady = isDevicePickerAvailable()

  function finish(imported: number, skipped: number, merged: number, warmthIds: string[]) {
    setResult({ imported, skipped, merged })
    setLoading(null)
    setHint('')
    onSuccess?.(imported + merged, skipped, warmthIds)
  }

  async function runImport(
    source: 'google' | 'microsoft' | 'device',
    fetcher: () => Promise<Awaited<ReturnType<typeof detectAndParseContacts>>>,
  ) {
    setError('')
    setHint('')
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

  function openFilePicker(kind: FileKind, loadingKey: typeof loading = 'file') {
    setError('')
    setResult(null)
    setHint(FILE_HINT[kind])
    setFileKind(kind)
    setLoading(loadingKey)
    // Defer so accept attribute updates before the dialog opens.
    requestAnimationFrame(() => {
      fileRef.current?.click()
      // If the user cancels the dialog, clear the loading spinner.
      window.setTimeout(() => {
        setLoading((prev) => (prev === loadingKey ? null : prev))
      }, 800)
    })
  }

  function handleGoogle() {
    if (googleReady) {
      void runImport('google', fetchGoogleContacts)
      return
    }
    openFilePicker('google', 'google')
  }

  function handleMicrosoft() {
    if (microsoftReady) {
      void runImport('microsoft', fetchMicrosoftContacts)
      return
    }
    openFilePicker('microsoft', 'microsoft')
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
        setError(FILE_HINT[fileKind] || FILE_HINT.any)
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
    setHint('')
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
          {loading === 'google'
            ? googleReady
              ? 'Signing in…'
              : 'Choose Google CSV…'
            : 'Google Contacts'}
        </button>

        <button
          type="button"
          className="auth-btn apple"
          disabled={Boolean(loading)}
          onClick={() => openFilePicker('apple', 'apple')}
        >
          <span className="auth-icon" aria-hidden>
            A
          </span>
          {loading === 'apple' ? 'Choose vCard…' : 'Apple Contacts'}
        </button>

        <button
          type="button"
          className="auth-btn linkedin"
          disabled={Boolean(loading)}
          onClick={() => openFilePicker('linkedin', 'linkedin')}
        >
          <span className="auth-icon" aria-hidden>
            in
          </span>
          {loading === 'linkedin' ? 'Choose Connections.csv…' : 'LinkedIn Connections'}
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
          {loading === 'microsoft'
            ? microsoftReady
              ? 'Signing in…'
              : 'Choose Outlook CSV…'
            : 'Microsoft Outlook'}
        </button>
      </div>

      {hint && <p className="import-action-hint">{hint}</p>}

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
        <span>or drop a file here</span>
      </div>

      <div
        className="drop-zone inline"
        onClick={() => openFilePicker('any', 'file')}
        onKeyDown={(e) => e.key === 'Enter' && openFilePicker('any', 'file')}
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
        accept={FILE_ACCEPT[fileKind]}
        multiple
        hidden
        onChange={(e) => {
          const list = e.target.files ? [...e.target.files] : []
          if (list.length) void handleFiles(list)
          else setLoading(null)
          e.target.value = ''
        }}
      />

      <details className="import-help">
        <summary>How to export</summary>
        <ul>
          <li>
            <strong>Google</strong> — Contacts → Export → Google CSV
            {googleReady ? ', or use one-click sign-in above.' : '.'}
          </li>
          <li>
            <strong>Apple</strong> — Contacts app → All Contacts → File → Export → Export vCard.
          </li>
          <li>
            <strong>LinkedIn</strong> — Settings → Data privacy → Get a copy of your data →
            Connections → upload <code>Connections.csv</code>.
          </li>
          <li>
            <strong>Outlook</strong> — Export contacts as CSV
            {microsoftReady ? ', or use one-click sign-in above.' : '.'}
          </li>
        </ul>
        <p className="section-hint">
          Optional live sync: add OAuth Client IDs in Settings (or <code>VITE_GOOGLE_CLIENT_ID</code>{' '}
          / <code>VITE_MICROSOFT_CLIENT_ID</code> on deploy).
        </p>
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
