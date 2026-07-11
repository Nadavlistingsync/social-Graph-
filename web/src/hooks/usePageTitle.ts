import { useEffect } from 'react'

const BASE_TITLE = 'Social Graph'

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE_TITLE}` : `${BASE_TITLE} — Who can intro me?`
    return () => {
      document.title = `${BASE_TITLE} — Who can intro me?`
    }
  }, [title])
}
