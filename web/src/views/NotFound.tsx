import { Link } from 'react-router-dom'
import { Shell } from '../components/Shell'

export function NotFound() {
  return (
    <Shell active="paths">
      <div className="empty-state not-found">
        <div className="error-code">404</div>
        <h1>That page isn’t in the graph.</h1>
        <p>The link may be outdated, or the person may not be mapped yet.</p>
        <Link className="btn-primary inline-button" to="/">
          Find an intro path
        </Link>
      </div>
    </Shell>
  )
}
