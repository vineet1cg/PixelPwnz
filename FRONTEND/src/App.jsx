import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import DatasetPage from './pages/DatasetPage.jsx'
import EventLogPage from './pages/EventLogPage.jsx'
import MapPage from './pages/MapPage.jsx'
import Sidebar from './components/layout/Sidebar.jsx'
import Navbar from './components/layout/Navbar.jsx'
import { TimeMachineProvider } from './contexts/TimeMachineContext.jsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import TimelineSlider from './components/layout/TimelineSlider.jsx'

/* Route guard for protected routes */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  return user ? children : <Navigate to="/login" replace />
}

/* Layout wrapper that includes the sidebar */
function AppShell({ children }) {
  return (
    <TimeMachineProvider>
      <div className="flex min-h-svh bg-bg-base text-text-primary pb-20">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
        <TimelineSlider />
      </div>
    </TimeMachineProvider>
  )
}

function AppRoutes() {
  return (
    <Routes>
      {/* Landing page — full-width, no sidebar */}
      <Route path="/" element={<LandingPage />} />

      {/* Auth pages — full-width, no sidebar */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Protected app pages — wrapped with sidebar */}
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <AppShell>
              <DashboardPage />
            </AppShell>
          </PrivateRoute>
        }
      />
      <Route
        path="/dataset/:id"
        element={
          <PrivateRoute>
            <AppShell>
              <DatasetPage />
            </AppShell>
          </PrivateRoute>
        }
      />
      <Route
        path="/events"
        element={
          <PrivateRoute>
            <AppShell>
              <EventLogPage />
            </AppShell>
          </PrivateRoute>
        }
      />
      <Route
        path="/map"
        element={
          <PrivateRoute>
            <AppShell>
              <MapPage />
            </AppShell>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}

export default App
