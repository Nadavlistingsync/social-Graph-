import { ContactAuthPanel } from './ContactAuthPanel'

export function ImportContactsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal modal-wide"
        role="dialog"
        aria-labelledby="import-contacts-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="import-contacts-title">Connect your contacts</h2>
        <p className="section-hint">
          Sign in once — we import people you know into your graph. Private, browser-only.
        </p>

        <ContactAuthPanel onSuccess={() => {}} />

        <div className="modal-actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="chip" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
