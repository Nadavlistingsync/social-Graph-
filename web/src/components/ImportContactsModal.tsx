import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ContactAuthPanel } from './ContactAuthPanel'
import { isContactsFile } from '../lib/launchContacts'
import { useContactImport } from '../context/ContactImportContext'

export function ImportContactsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { importFiles } = useContactImport()
  const [dragOver, setDragOver] = useState(false)

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const files = [...e.dataTransfer.files].filter(isContactsFile)
      if (!files.length) return
      const result = await importFiles(files)
      if (result && result.imported > 0) {
        onClose()
        navigate('/rate')
      }
    },
    [importFiles, navigate, onClose],
  )

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`modal modal-wide ${dragOver ? 'drag-over' : ''}`}
        role="dialog"
        aria-labelledby="import-contacts-title"
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <h2 id="import-contacts-title">Add people you know</h2>
        <p className="section-hint">Paste names, upload a file, or drop one here.</p>

        <ContactAuthPanel
          onSuccess={() => {
            onClose()
            navigate('/rate')
          }}
        />

        <div className="modal-actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="chip" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
