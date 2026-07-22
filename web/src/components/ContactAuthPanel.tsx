import { useCallback, useMemo, useRef, useState } from 'react'
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

export function ContactAuthPanel({
  onSuccess,
  onSkip,
  showSkip = false,
  compact = false,
}: ContactAuthPanelProps) {
  const { importContacts } = useGraph()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState<'paste' | 'file' | 'device' | 'google' | 'microsoft' | null>(
    null,
  )
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    imported: number
    skipped: number
    merged: number
  } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const googleReady = isGoogleContactsAvailable()
  const microsoftReady = isMicrosoftContactsAvailable()
  const deviceReady = isDevicePickerAvailable()
  const preview = useMemo(() => parsePastedContacts(pasteText), [pasteText])

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
        setError('No contacts found. Try pasting names or uploading a file.')
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
        setError('Drop a .vcf or .csv contacts file.')
        setLoading(null)
        return
      }
      if (!imported && !merged) {
        setError('No contacts found in that file.')
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
      setError('Add at least one name — one per line, or comma-separated.')
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
          {result.merged ? ` · merged ${result.merged}` : ''}{' '}
          {result.imported + result.merged === 1 ? 'person' : 'people'}
        </strong>
        {result.skipped > 0 && (
          <p className="section-hint">Skipped {result.skipped} incomplete rows.</p>
        )}
        <p className="section-hint">Next: how well do you know them?</p>
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
      <div className="paste-first">
        <label className="field-label" htmlFor="paste-people">
          Type or paste names
        </label>
        <textarea
          id="paste-people"
          className="paste-hero"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={compact ? 5 : 7}
          autoFocus
          placeholder={'Alex Chen\nSam Rivera\nJordan Lee, jordan@acme.com'}
          aria-label="Type or paste names"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && pasteText.trim()) {
              e.preventDefault()
              handlePaste()
            }
          }}
        />
        <div className="paste-first-meta">
          <span className="section-hint">
            {preview.length
              ? `${preview.length} ${preview.length === 1 ? 'person' : 'people'} ready`
              : 'One per line, or comma-separated'}
          </span>
          <button
            type="button"
            className="btn-primary"
            disabled={Boolean(loading) || preview.length === 0}
            onClick={handlePaste}
          >
            {loading === 'paste'
              ? 'Adding…'
              : preview.length
                ? `Add ${preview.length}`
                : 'Add people'}
          </button>
        </div>
      </div>

      <div className="easy-secondary">
        <button
          type="button"
          className="chip on"
          disabled={Boolean(loading)}
          onClick={() => {
            setError('')
            fileRef.current?.click()
          }}
        >
          {loading === 'file' ? 'Reading…' : 'Upload file'}
        </button>
        {deviceReady && (
          <button
            type="button"
            className="chip"
            disabled={Boolean(loading)}
            onClick={() => void runImport('device', pickDeviceContacts)}
          >
            {loading === 'device' ? 'Opening…' : 'From this device'}
          </button>
        )}
        {googleReady && (
          <button
            type="button"
            className="chip"
            disabled={Boolean(loading)}
            onClick={() => void runImport('google', fetchGoogleContacts)}
          >
            {loading === 'google' ? 'Signing in…' : 'Google'}
          </button>
        )}
        {microsoftReady && (
          <button
            type="button"
            className="chip"
            disabled={Boolean(loading)}
            onClick={() => void runImport('microsoft', fetchMicrosoftContacts)}
          >
            {loading === 'microsoft' ? 'Signing in…' : 'Outlook'}
          </button>
        )}
      </div>

      <p className="drop-hint section-hint">Or drop a .vcf / .csv anywhere on this card</p>

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
        <summary>Need a contacts export?</summary>
        <ul>
          <li>
            <strong>Google</strong> — Contacts → Export → Google CSV → Upload file
          </li>
          <li>
            <strong>Apple</strong> — Contacts → File → Export vCard → Upload file
          </li>
          <li>
            <strong>LinkedIn</strong> — Settings → Get a copy of your data → Connections.csv
          </li>
          <li>
            <strong>Outlook</strong> — Export contacts as CSV → Upload file
          </li>
        </ul>
      </details>

      <p className="section-hint auth-hint">Private to you. Syncs if you’re signed in.</p>

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
