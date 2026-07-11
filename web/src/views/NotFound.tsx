import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Shell } from '../components/Shell'

export function NotFound() {
  useEffect(() => {
    document.title = 'Page not found · Social Graph'
  }, [])

  return (
    <Shell active="paths">
      <div className="empty-state">
        <h1>Page not found</h1>
        <p>The page you requested does not exist or has moved.</p>
        <Link to="/">Return to path finder</Link>
      </div>
    </Shell>
  )
}
