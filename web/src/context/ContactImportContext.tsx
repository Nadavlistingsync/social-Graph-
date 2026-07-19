import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { isContactsFile, parseContactsFile, registerLaunchQueueConsumer } from '../lib/launchContacts'
import { ImportContactsModal } from '../components/ImportContactsModal'
import { useGraph } from '../context/GraphContext'

type PendingImport = {
  files: File[]
}

type ContactImportContextValue = {
  openImport: () => void
  importFiles: (files: File[]) => Promise<{ imported: number; skipped: number } | null>
}

const ContactImportContext = createContext<ContactImportContextValue | null>(null)

export function ContactImportProvider({ children }: { children: ReactNode }) {
  const { importContacts, isOnboarded } = useGraph()
  const [modalOpen, setModalOpen] = useState(false)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [autoMessage, setAutoMessage] = useState<string | null>(null)

  const importFiles = useCallback(
    async (files: File[]) => {
      const contactFiles = files.filter(isContactsFile)
      if (!contactFiles.length) return null

      let allImported = 0
      let allSkipped = 0

      for (const file of contactFiles) {
        const contacts = await parseContactsFile(file)
        if (!contacts.length) continue
        const res = importContacts(contacts)
        if (res.ok) {
          allImported += res.imported + res.merged
          allSkipped += res.skipped
        }
      }

      if (allImported > 0) {
        setAutoMessage(`Imported ${allImported} contacts from your file.`)
      }
      return { imported: allImported, skipped: allSkipped }
    },
    [importContacts],
  )

  const openImport = useCallback(() => setModalOpen(true), [])

  useEffect(() => {
    if (!isOnboarded) return

    const params = new URLSearchParams(window.location.search)
    if (params.get('import') === '1' || params.get('import') === 'file') {
      setModalOpen(true)
      params.delete('import')
      const next = params.toString()
      window.history.replaceState({}, '', next ? `?${next}` : window.location.pathname)
    }
  }, [isOnboarded])

  useEffect(() => {
    if (!isOnboarded) return

    registerLaunchQueueConsumer(async (files) => {
      const result = await importFiles(files)
      if (result && result.imported > 0) setModalOpen(true)
      setPending({ files })
    })
  }, [isOnboarded, importFiles])

  useEffect(() => {
    if (!pending || !isOnboarded) return
    void importFiles(pending.files).then(() => setPending(null))
  }, [pending, isOnboarded, importFiles])

  return (
    <ContactImportContext.Provider value={{ openImport, importFiles }}>
      {children}
      {autoMessage && (
        <div className="toast" role="status">
          {autoMessage}
          <button type="button" className="toast-close" onClick={() => setAutoMessage(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
      <ImportContactsModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </ContactImportContext.Provider>
  )
}

export function useContactImport(): ContactImportContextValue {
  const ctx = useContext(ContactImportContext)
  if (!ctx) throw new Error('useContactImport must be used within ContactImportProvider')
  return ctx
}
