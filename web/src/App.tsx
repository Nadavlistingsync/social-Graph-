import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ContactImportProvider } from './context/ContactImportContext'
import { GraphProvider, useGraph } from './context/GraphContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { GraphView } from './views/GraphView'
import { NotFound } from './views/NotFound'
import { Onboarding } from './views/Onboarding'
import { PersonPage } from './views/PersonPage'
import { PathFinder } from './views/PathFinder'
import { Settings } from './views/Settings'

function AppRoutes() {
  const { ready: authReady } = useAuth()
  const { isOnboarded } = useGraph()

  if (!authReady) {
    return (
      <div className="onboarding">
        <div className="onboarding-card" id="main">
          <div className="brand-mark">Social Graph</div>
          <p className="lede">Loading…</p>
        </div>
      </div>
    )
  }

  if (!isOnboarded) return <Onboarding />

  return (
    <Routes>
      <Route path="/" element={<GraphView />} />
      <Route path="/find" element={<PathFinder />} />
      <Route path="/graph" element={<Navigate to="/" replace />} />
      <Route path="/person/:id" element={<PersonPage />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/paths" element={<Navigate to="/find" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <GraphProvider>
          <PreferencesProvider>
            <ContactImportProvider>
              <BrowserRouter>
                <a href="#main" className="skip-link">
                  Skip to content
                </a>
                <AppRoutes />
              </BrowserRouter>
            </ContactImportProvider>
          </PreferencesProvider>
        </GraphProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
