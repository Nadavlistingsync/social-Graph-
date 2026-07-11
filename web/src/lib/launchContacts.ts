import { detectAndParseContacts } from '../data/contactImport'

export function isVcardFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return (
    name.endsWith('.vcf') ||
    file.type === 'text/vcard' ||
    file.type === 'text/x-vcard' ||
    file.type === 'application/vcard'
  )
}

export function isContactsCsv(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.csv') || file.type === 'text/csv'
}

export function isContactsFile(file: File): boolean {
  return isVcardFile(file) || isContactsCsv(file)
}

export async function parseContactsFile(file: File) {
  const raw = await file.text()
  return detectAndParseContacts(raw, file.name)
}

type FileSystemFileHandle = FileSystemHandle & { getFile: () => Promise<File> }

type LaunchQueueWindow = Window & {
  launchQueue?: {
    setConsumer: (cb: (params: { files: FileSystemFileHandle[] }) => void) => void
  }
}

export function registerLaunchQueueConsumer(onFiles: (files: File[]) => void): void {
  const w = window as LaunchQueueWindow
  if (!w.launchQueue?.setConsumer) return

  w.launchQueue.setConsumer(async (params) => {
    try {
      const files = await Promise.all(params.files.map((h) => h.getFile()))
      const contactFiles = files.filter(isContactsFile)
      if (contactFiles.length) onFiles(contactFiles)
    } catch {
      /* ignore */
    }
  })
}
