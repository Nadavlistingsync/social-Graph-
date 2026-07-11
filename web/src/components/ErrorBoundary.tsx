import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Social Graph crashed', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="empty-state" style={{ paddingTop: '20vh' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--text)' }}>
            Something broke.
          </p>
          <p>{this.state.error.message}</p>
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto', marginTop: '1rem' }}
            onClick={() => {
              this.setState({ error: null })
              window.location.assign('/')
            }}
          >
            Back home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
