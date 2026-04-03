import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import DatasetPage from './pages/DatasetPage.jsx'
import EventLogPage from './pages/EventLogPage.jsx'
import MapPage from './pages/MapPage.jsx'
import Sidebar from './components/layout/Sidebar.jsx'
import './App.css'

/* Layout wrapper that includes the sidebar */
function AppShell({ children }) {
  return (
    <div className="flex min-h-svh bg-bg-base text-text-primary">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing page — full-width, no sidebar */}
        <Route path="/" element={<LandingPage />} />

        {/* App pages — wrapped with sidebar */}
        <Route path="/dashboard" element={<AppShell><DashboardPage /></AppShell>} />
        <Route path="/dataset/:id" element={<AppShell><DatasetPage /></AppShell>} />
        <Route path="/events" element={<AppShell><EventLogPage /></AppShell>} />
        <Route path="/map" element={<AppShell><MapPage /></AppShell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
