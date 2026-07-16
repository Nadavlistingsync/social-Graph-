import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ContactImportProvider } from './context/ContactImportContext'
import { GraphProvider, useGraph } from './context/GraphContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { clearAwaitingContactStep, isAwaitingContactStep } from './lib/onboardingFlow'
import { GraphView } from './views/GraphView'
import { NotFound } from './views/NotFound'
import { Onboarding } from './views/Onboarding'
import { PersonPage } from './views/PersonPage'
import { PathFinder } from './views/PathFinder'
import { Settings } from './views/Settings'

function AppRoutes() {
  const { isOnboarded } = useGraph()
  const [awaitingContacts, setAwaitingContacts] = useState(isAwaitingContactStep)

  const showOnboarding = !isOnboarded || awaitingContacts

  if (showOnboarding) {
    return (
      <Onboarding
        contactsOnly={isOnboarded && awaitingContacts}
        onWorkspaceCreated={() => setAwaitingContacts(true)}
        onEnterApp={() => {
          clearAwaitingContactStep()
          setAwaitingContacts(false)
        }}
      />
    )
  }

  return (
    <Routes>
      <Route path="/" element={<PathFinder />} />
      <Route path="/graph" element={<GraphView />} />
      <Route path="/person/:id" element={<PersonPage />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/paths" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  )
}
