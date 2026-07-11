import { useEffect } from 'react'

const DEFAULT_TITLE = 'Social Graph — Who can intro me?'

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${title} · Social Graph` : DEFAULT_TITLE
    return () => {
      document.title = prev
    }
  }, [title])
}
