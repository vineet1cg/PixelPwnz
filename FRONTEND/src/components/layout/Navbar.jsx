import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../../contexts/AuthContext'
import { useState } from 'react'

const PAGE_TITLES = {
  '/dashboard': { title: 'Dashboard', desc: 'Temporal insights at a glance' },
  '/events':    { title: 'Event Log', desc: 'Track anomalies and changes' },
  '/map':       { title: 'Map View', desc: 'Geographic data visualization' },
}

function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Match dynamic dataset route
  const isDataset = pathname.startsWith('/dataset/')
  const page = isDataset
    ? { title: 'Dataset Detail', desc: 'Historical analysis & trends' }
    : PAGE_TITLES[pathname] ?? { title: 'DataTime Machine', desc: '' }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
  }

  return (
    <header className="flex items-center justify-between border-b border-edge bg-bg-raised px-8 py-4">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex items-center gap-4"
      >
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-text-primary">
            {page.title}
          </h1>
          {page.desc && (
            <p className="mt-0.5 text-xs text-text-secondary">{page.desc}</p>
          )}
        </div>
      </motion.div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="card flex cursor-pointer items-center gap-2 px-3.5 py-2 text-sm text-text-secondary transition-all duration-200 hover:border-bg-hover hover:text-text-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="hidden text-xs md:inline">Search datasets…</span>
          <kbd className="ml-4 hidden rounded-md border border-edge bg-bg-base px-1.5 py-0.5 text-[10px] text-text-muted md:inline">
            ⌘K
          </kbd>
        </div>

        {/* Live Badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald/25 bg-emerald/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald" />
          </span>
          Live
        </div>

        {/* User Menu */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-xs font-bold text-bg-base transition-all"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #fb7185)',
              boxShadow: '0 0 14px rgba(245,158,11,0.3)',
            }}
          >
            {user ? getInitials(user.name) : 'R'}
          </motion.button>

          {/* Dropdown Menu */}
          {showUserMenu && user && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute right-0 mt-2 w-48 rounded-lg border border-edge bg-bg-raised shadow-lg py-1"
            >
              <div className="px-4 py-2 border-b border-edge">
                <p className="text-sm font-semibold text-text-primary">{user.name}</p>
                <p className="text-xs text-text-secondary">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
              >
                Sign out
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar
