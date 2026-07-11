import { useRef, useState } from 'react'
import { detectAndParseContacts } from '../data/contactImport'
import { useGraph } from '../context/GraphContext'
import { fetchGoogleContacts, isGoogleContactsAvailable } from '../lib/googleContacts'

export function ImportContactsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { importContacts } = useGraph()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const googleEnabled = isGoogleContactsAvailable()

  if (!open) return null

  function finish(imported: number, skipped: number) {
    setResult({ imported, skipped })
    setLoading(false)
  }

  async function handleGoogle() {
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const contacts = await fetchGoogleContacts()
      const res = importContacts(contacts)
      if (!res.ok) {
        setError(res.error)
        setLoading(false)
        return
      }
      finish(res.imported, res.skipped)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google import failed')
      setLoading(false)
    }
  }

  function handleFile(file: File) {
    setError('')
    setResult(null)
    setLoading(true)
    file
      .text()
      .then((raw) => {
        const contacts = detectAndParseContacts(raw, file.name)
        if (!contacts.length) {
          setError('No contacts found. Try a .vcf or .csv export from Google or Apple Contacts.')
          setLoading(false)
          return
        }
        const res = importContacts(contacts)
        if (!res.ok) {
          setError(res.error)
          setLoading(false)
          return
        }
        finish(res.imported, res.skipped)
      })
      .catch(() => {
        setError('Could not read file')
        setLoading(false)
      })
  }

  function close() {
    setError('')
    setResult(null)
    setLoading(false)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={close} role="presentation">
      <div
        className="modal modal-wide"
        role="dialog"
        aria-labelledby="import-contacts-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="import-contacts-title">Import contacts</h2>
        <p className="section-hint">
          Pull people from your address book into your graph. Imports stay in this browser only.
        </p>

        {result ? (
          <div className="import-result">
            <strong>Import complete</strong>
            <p>
              Added {result.imported} people
              {result.skipped > 0 ? ` · skipped ${result.skipped} duplicates` : ''}. They&apos;re
              marked as people you know.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={close}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="import-options">
              {googleEnabled && (
                <button
                  type="button"
                  className="import-card"
                  disabled={loading}
                  onClick={handleGoogle}
                >
                  <strong>Connect Google Contacts</strong>
                  <span>Sign in with Google and import your contacts directly.</span>
                </button>
              )}

              <button
                type="button"
                className="import-card"
                disabled={loading}
                onClick={() => fileRef.current?.click()}
              >
                <strong>Upload file</strong>
                <span>Apple (.vcf), Google CSV, or Outlook CSV export.</span>
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
            </div>

            <details className="import-help">
              <summary>How to export from Apple Contacts or Gmail</summary>
              <ul>
                <li>
                  <strong>Apple Contacts (Mac):</strong> select contacts → File → Export → Export
                  vCard… → upload the .vcf file here.
                </li>
                <li>
                  <strong>Apple (iPhone/iPad):</strong> no direct export — use a Mac or iCloud.com →
                  Contacts → select all → gear icon → Export vCard.
                </li>
                <li>
                  <strong>Gmail:</strong> Google Contacts → Export → Google CSV (or connect above if
                  enabled).
                </li>
                <li>
                  <strong>Outlook:</strong> File → Import and Export → export to CSV.
                </li>
              </ul>
            </details>

            {!googleEnabled && (
              <p className="section-hint" style={{ marginTop: '0.75rem' }}>
                Google sign-in can be enabled by the site operator (VITE_GOOGLE_CLIENT_ID). File
                upload works everywhere.
              </p>
            )}

            {loading && <p className="section-hint">Importing…</p>}
            {error && <p className="form-error">{error}</p>}

            <div className="modal-actions">
              <button type="button" className="chip" onClick={close} disabled={loading}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
