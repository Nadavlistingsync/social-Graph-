import { Link } from 'react-router-dom'
import { Shell } from '../components/Shell'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function NotFound() {
  useDocumentTitle('Page not found')

  return (
    <Shell active="paths">
      <div className="empty-state" style={{ paddingTop: '12vh' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: '0 0 0.5rem' }}>
          Page not found
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          That route doesn&apos;t exist in this graph.
        </p>
        <Link to="/" className="btn-primary" style={{ display: 'inline-block', width: 'auto' }}>
          Back to path finder
        </Link>
      </div>
    </Shell>
  )
}
