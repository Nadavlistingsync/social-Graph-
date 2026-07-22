import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { DemoGuide } from './components/DemoGuide'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ContactImportProvider } from './context/ContactImportContext'
import { GraphProvider, useGraph } from './context/GraphContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { GraphView } from './views/GraphView'
import { NotFound } from './views/NotFound'
import { CONTACTS_GATE_EVENT, isContactsGateOpen, Onboarding } from './views/Onboarding'
import { PersonPage } from './views/PersonPage'
import { PathFinder } from './views/PathFinder'
import { RateContacts } from './views/RateContacts'
import { Settings } from './views/Settings'

function AppRoutes() {
  const { ready: authReady } = useAuth()
  const { isOnboarded, startInvestorDemo: launchDemo } = useGraph()
  const [contactsGate, setContactsGate] = useState(isContactsGateOpen)
  const [params] = useSearchParams()

  useEffect(() => {
    const sync = () => setContactsGate(isContactsGateOpen())
    window.addEventListener(CONTACTS_GATE_EVENT, sync)
    return () => window.removeEventListener(CONTACTS_GATE_EVENT, sync)
  }, [])

  useEffect(() => {
    if (!authReady) return
    if (params.get('demo') === '1') {
      launchDemo()
    }
  }, [authReady, params, launchDemo])

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

  // Contacts / rate steps run after finishOnboarding so imports + scoring can write.
  if (!isOnboarded || contactsGate) return <Onboarding />

  return (
    <>
      <Routes>
        <Route path="/" element={<GraphView />} />
        <Route path="/find" element={<PathFinder />} />
        <Route path="/rate" element={<RateContacts />} />
        <Route path="/graph" element={<Navigate to="/" replace />} />
        <Route path="/person/:id" element={<PersonPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/paths" element={<Navigate to="/find" replace />} />
        <Route path="/demo" element={<Navigate to={{ pathname: '/', search: '?demo=1' }} replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <DemoGuide />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <GraphProvider>
          <PreferencesProvider>
            <BrowserRouter>
              <ContactImportProvider>
                <a href="#main" className="skip-link">
                  Skip to content
                </a>
                <AppRoutes />
              </ContactImportProvider>
            </BrowserRouter>
          </PreferencesProvider>
        </GraphProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
