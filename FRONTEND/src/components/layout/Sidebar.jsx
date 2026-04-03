import { NavLink, Link } from 'react-router-dom'
import { motion } from 'motion/react'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>
  )},
  { to: '/events', label: 'Events', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
  )},
  { to: '/map', label: 'Map', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
  )},
]

function Sidebar() {
  return (
    <aside className="flex w-16 shrink-0 flex-col items-center border-r border-edge bg-bg-base py-4 gap-6">
      {/* Logo */}
      <Link to="/" title="Home">
        <motion.div
          whileHover={{ scale: 1.1 }}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber to-rose cursor-pointer"
          style={{ boxShadow: '0 0 16px rgba(245,158,11,0.25)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </motion.div>
      </Link>

      {/* Nav Icons */}
      <nav className="flex flex-col items-center gap-1">
        {NAV.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} title={label}>
            {({ isActive }) => (
              <div className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 ${
                isActive
                  ? 'bg-bg-hover text-text-primary'
                  : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
              }`}>
                {isActive && (
                  <motion.div
                    layoutId="nav-dot"
                    className="absolute -left-[13px] h-5 w-1 rounded-r-full bg-amber"
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  />
                )}
                {icon}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Bottom: Status + Settings */}
      <div className="flex flex-col items-center gap-3">
        <button title="Settings" className="flex h-10 w-10 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        {/* Online dot */}
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75"/>
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald"/>
        </span>
      </div>
    </aside>
  )
}

export default Sidebar
