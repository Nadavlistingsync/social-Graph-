import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GraphView } from './views/GraphView'
import { PersonPage } from './views/PersonPage'
import { PathFinder } from './views/PathFinder'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PathFinder />} />
        <Route path="/graph" element={<GraphView />} />
        <Route path="/person/:id" element={<PersonPage />} />
        <Route path="/paths" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
