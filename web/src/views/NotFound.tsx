import { Link } from 'react-router-dom'
import { Shell } from '../components/Shell'
import { usePageTitle } from '../hooks/usePageTitle'

export function NotFound() {
  usePageTitle('Page not found')
  return (
    <Shell active="paths">
      <div className="empty-state" style={{ width: '100%', paddingTop: '18vh' }}>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.6rem',
            color: 'var(--text)',
            margin: '0 0 0.5rem',
          }}
        >
          Page not found
        </p>
        <p style={{ margin: '0 0 1.5rem' }}>That page doesn’t exist in this graph.</p>
        <Link to="/" className="btn-primary" style={{ width: 'auto', display: 'inline-block', padding: '0.7rem 1.2rem' }}>
          Back to Path Finder
        </Link>
      </div>
    </Shell>
  )
}
