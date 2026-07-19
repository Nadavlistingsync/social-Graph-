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
  const [dropping, setDropping] = useState(false)

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const files = [...e.dataTransfer.files].filter(isContactsFile)
      if (!files.length) return
      setDropping(true)
      const result = await importFiles(files)
      setDropping(false)
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
        <h2 id="import-contacts-title">Add your contacts</h2>
        <p className="section-hint">
          Google, Apple, LinkedIn, or paste — then rate how well you know them.
        </p>

        <div className="drop-zone">
          {dropping ? 'Importing…' : 'Drop .vcf or .csv here (Apple, Google, or LinkedIn)'}
        </div>

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
