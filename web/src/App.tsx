import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PreferencesProvider } from './context/PreferencesContext'
import { GraphView } from './views/GraphView'
import { NotFound } from './views/NotFound'
import { PersonPage } from './views/PersonPage'
import { PathFinder } from './views/PathFinder'

export default function App() {
  return (
    <ErrorBoundary>
      <PreferencesProvider>
        <BrowserRouter>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <Routes>
            <Route path="/" element={<PathFinder />} />
            <Route path="/graph" element={<GraphView />} />
            <Route path="/person/:id" element={<PersonPage />} />
            <Route path="/paths" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </PreferencesProvider>
    </ErrorBoundary>
  )
}
