import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../lib/api.js'

/* ── Category config ──────────────────────────────── */
const CAT = {
  crypto:      { label: 'Crypto',      accent: '#f59e0b', icon: '📈' },
  air_quality: { label: 'Air Quality', accent: '#fb7185', icon: '🌫️' },
  weather:     { label: 'Weather',     accent: '#38bdf8', icon: '🌡️' },
  forex:       { label: 'Forex',       accent: '#a78bfa', icon: '💱' },
}

const SEV_COLOR = { high: '#fb7185', medium: '#f59e0b', low: '#38bdf8' }

/* ── Helpers ──────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatValue(v, unit) {
  if (v == null || v === '—') return '—'
  if (unit === 'USD') return `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  if (unit === 'INR') return `₹${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  // Forex pairs (EUR, GBP, JPY, etc.) — show exchange rate
  if (['EUR', 'GBP', 'JPY', 'AUD', 'USDC'].includes(unit)) return `${Number(v).toFixed(4)} ${unit}`
  return `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`
}

/* ── Chart tooltip ────────────────────────────────── */
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-xs shadow-xl">
      <p className="text-text-muted">{label}</p>
      <p className="font-mono font-bold text-amber">{payload[0].value}</p>
    </div>
  )
}

/* ── Animation ────────────────────────────────────── */
const pop = { hidden: { opacity: 0, y: 12, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 22 } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }

/* ══════════════════════════════════════════════════ */
function DashboardPage() {
  const [datasets, setDatasets] = useState([])
  const [events, setEvents]   = useState([])
  const [snapCache, setSnapCache] = useState({}) // id → latest snapshots
  const [activeCat, setActiveCat] = useState('all')
  const [activeDs, setActiveDs]   = useState(null) // selected dataset for chart
  const [chartSnaps, setChartSnaps] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch datasets + events on mount
  useEffect(() => {
    async function load() {
      try {
        const [ds, ev] = await Promise.all([api.getDatasets(), api.getEvents()])
        setDatasets(ds)
        setEvents(ev.slice(0, 10))
        if (ds.length) setActiveDs(ds[0])
        setLoading(false)

        // Background: fetch latest values for all datasets
        for (const d of ds) {
          api.getSnapshots(d._id).then(snaps => {
            if (!snaps.length) return
            const latest = snaps[snaps.length - 1]
            const prev = snaps.length > 1 ? snaps[snaps.length - 2] : latest
            const pct = prev.value !== 0 ? ((latest.value - prev.value) / prev.value * 100) : 0
            setSnapCache(p => ({ ...p, [d._id]: { value: latest.value, pct, ts: latest.timestamp, count: snaps.length } }))
          }).catch(() => {})
        }
      } catch (err) {
        console.error('Dashboard load failed:', err)
        setLoading(false)
      }
    }
    load()
  }, [])

  // Load chart snapshots when active dataset changes
  useEffect(() => {
    if (!activeDs?._id) return
    api.getSnapshots(activeDs._id).then(setChartSnaps).catch(console.error)
  }, [activeDs?._id])

  // Chart data
  const chartData = useMemo(() => {
    return chartSnaps.map(s => ({
      label: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: s.value,
    }))
  }, [chartSnaps])

  // Grouped/filtered datasets
  const categories = useMemo(() => {
    const cats = {}
    datasets.forEach(d => {
      if (!cats[d.category]) cats[d.category] = []
      cats[d.category].push(d)
    })
    return cats
  }, [datasets])

  const filteredDatasets = useMemo(() => {
    if (activeCat === 'all') return datasets
    return datasets.filter(d => d.category === activeCat)
  }, [datasets, activeCat])

  // Summary stats
  const stats = useMemo(() => ({
    datasets: datasets.length,
    events: events.length,
    categories: Object.keys(categories).length,
    critical: events.filter(e => e.severity === 'high').length,
  }), [datasets, events, categories])

  const activeAccent = activeDs ? (CAT[activeDs.category]?.accent || '#a78bfa') : '#f59e0b'

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-40">
        <div className="flex flex-col items-center gap-3 text-text-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-transparent" />
          <span className="text-sm">Loading dashboard…</span>
        </div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-0">

      {/* ── Header ────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-edge px-8 py-5">
        <div>
          <h1 className="text-lg font-bold tracking-tight">{getGreeting()}</h1>
          <p className="mt-0.5 text-sm text-text-secondary">Tracking <span className="font-mono text-text-primary">{stats.datasets}</span> datasets across {stats.categories} categories</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-edge bg-bg-raised px-3 py-2 text-sm text-text-muted transition-colors hover:border-bg-hover">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span className="hidden text-xs md:inline">Search…</span>
            <kbd className="ml-3 hidden rounded border border-edge bg-bg-base px-1.5 py-0.5 text-[10px] font-mono text-text-muted md:inline">⌘K</kbd>
          </div>
        </div>
      </header>

      <div className="px-8 py-6 flex flex-col gap-6">

        {/* ── Summary Stats ────────────────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'Total Datasets', val: stats.datasets, accent: '#f59e0b', icon: '📊' },
            { label: 'Events Detected', val: stats.events, accent: '#fb7185', icon: '⚡' },
            { label: 'Critical Alerts', val: stats.critical, accent: stats.critical > 0 ? '#fb7185' : '#34d399', icon: '🔴' },
            { label: 'System Status',   val: 'Live', accent: '#34d399', icon: '🟢' },
          ].map(s => (
            <motion.div key={s.label} variants={pop} className="card px-4 py-3 flex items-center gap-3">
              <span className="text-xl">{s.icon}</span>
              <div>
                <p className="text-xl font-bold tabular-nums" style={{ color: s.accent }}>{s.val}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Category Filter ──────────────────── */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCat('all')}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all"
            style={{
              borderColor: activeCat === 'all' ? '#a1a1aa' : '#27272a',
              background: activeCat === 'all' ? 'rgba(161,161,170,0.08)' : 'transparent',
              color: activeCat === 'all' ? '#fafafa' : '#71717a',
            }}
          >
            All <span className="ml-1 font-mono opacity-60">{datasets.length}</span>
          </button>
          {Object.entries(CAT).map(([key, cfg]) => {
            const count = categories[key]?.length || 0
            if (!count) return null
            const active = activeCat === key
            return (
              <button
                key={key}
                onClick={() => setActiveCat(key)}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  borderColor: active ? cfg.accent : '#27272a',
                  background: active ? `${cfg.accent}12` : 'transparent',
                  color: active ? cfg.accent : '#71717a',
                }}
              >
                {cfg.icon} {cfg.label} <span className="ml-1 font-mono opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        {/* ── Bento: Dataset Grid + Chart + Activity */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

          {/* ─ Dataset Table (8 cols) ──────────── */}
          <motion.div variants={pop} initial="hidden" animate="show" className="card flex flex-col lg:col-span-8 max-h-[440px]">
            <div className="flex items-center justify-between border-b border-edge px-5 py-3">
              <span className="text-sm font-semibold">Datasets</span>
              <span className="text-xs text-text-muted">{filteredDatasets.length} tracked</span>
            </div>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 border-b border-edge-subtle px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              <span className="col-span-4">Name</span>
              <span className="col-span-2">Category</span>
              <span className="col-span-2 text-right">Value</span>
              <span className="col-span-2 text-right">Change</span>
              <span className="col-span-2 text-right">Updated</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-edge-subtle">
              {filteredDatasets.map(ds => {
                const cat = CAT[ds.category] || { label: ds.category, accent: '#a78bfa', icon: '•' }
                const snap = snapCache[ds._id]
                const isActive = activeDs?._id === ds._id
                return (
                  <div
                    key={ds._id}
                    onClick={() => setActiveDs(ds)}
                    className={`grid grid-cols-12 gap-2 px-5 py-2.5 cursor-pointer items-center text-sm transition-colors ${isActive ? 'bg-bg-hover/60' : 'hover:bg-bg-hover/30'}`}
                  >
                    <Link to={`/dataset/${ds._id}`} className="col-span-4 flex items-center gap-2 min-w-0" onClick={e => e.stopPropagation()}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cat.accent }} />
                      <span className="truncate text-xs font-semibold text-text-primary hover:underline">{ds.name}</span>
                    </Link>
                    <span className="col-span-2">
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: `${cat.accent}12`, color: cat.accent }}>
                        {cat.label}
                      </span>
                    </span>
                    <span className="col-span-2 text-right font-mono text-xs text-text-secondary">
                      {snap ? formatValue(snap.value, ds.unit) : '—'}
                    </span>
                    <span className="col-span-2 text-right font-mono text-xs font-bold" style={{ color: snap ? (snap.pct >= 0 ? '#34d399' : '#fb7185') : '#52525b' }}>
                      {snap ? `${snap.pct >= 0 ? '+' : ''}${snap.pct.toFixed(2)}%` : '—'}
                    </span>
                    <span className="col-span-2 text-right text-[10px] text-text-muted">
                      {snap ? timeAgo(snap.ts) : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* ─ Activity Feed (4 cols) ──────────── */}
          <motion.div variants={pop} initial="hidden" animate="show" className="card flex flex-col lg:col-span-4 max-h-[440px]">
            <div className="flex items-center justify-between border-b border-edge px-5 py-3">
              <span className="text-sm font-semibold">Activity</span>
              <Link to="/events" className="rounded-full bg-rose-soft px-2 py-0.5 text-[10px] font-bold tabular-nums text-rose">{events.length}</Link>
            </div>
            <div className="flex-1 flex flex-col divide-y divide-edge-subtle overflow-y-auto">
              {events.length === 0 && (
                <div className="flex flex-1 items-center justify-center py-8 text-sm text-text-muted">No events yet</div>
              )}
              {events.map((ev, i) => (
                <motion.div
                  key={ev._id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.04 }}
                  className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-bg-hover/50"
                >
                  <span
                    className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: SEV_COLOR[ev.severity] || '#52525b', boxShadow: `0 0 6px ${SEV_COLOR[ev.severity] || '#52525b'}50` }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs text-text-primary">{ev.message}</p>
                    <p className="mt-0.5 text-[10px] text-text-muted">{timeAgo(ev.timestamp)}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ─ Chart Panel (full width) ─────────── */}
          <motion.div variants={pop} initial="hidden" animate="show" className="card flex flex-col lg:col-span-12">
            <div className="flex items-center justify-between border-b border-edge px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: activeAccent }} />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={activeDs?.name}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="text-sm font-semibold"
                  >
                    {activeDs?.name ?? 'Select a dataset'}
                  </motion.span>
                </AnimatePresence>
                <span className="text-xs text-text-muted">— {chartData.length} snapshots</span>
              </div>
              {activeDs && (
                <Link to={`/dataset/${activeDs._id}`} className="text-xs font-semibold transition-colors hover:underline" style={{ color: activeAccent }}>
                  View details →
                </Link>
              )}
            </div>
            <div className="flex-1 p-4" style={{ minHeight: 240 }}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={activeAccent} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={activeAccent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.max(1, Math.floor(chartData.length / 10))} />
                    <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} cursor={{ stroke: 'rgba(255,255,255,0.06)' }} />
                    <Area type="monotone" dataKey="value" stroke={activeAccent} strokeWidth={2} fill="url(#mainGrad)" dot={false} activeDot={{ r: 4, fill: activeAccent, stroke: '#09090b', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-text-muted">No snapshot data yet</div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

export default DashboardPage
