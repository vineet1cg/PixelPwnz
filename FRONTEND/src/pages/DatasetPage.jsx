import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../lib/api.js'

/* ── Accent map by category ───────────────────────── */
const ACCENT = {
  crypto:      '#f59e0b',
  air_quality: '#fb7185',
  weather:     '#38bdf8',
  forex:       '#a78bfa',
}

const SEV_COLOR = {
  high:   '#fb7185',
  medium: '#f59e0b',
  low:    '#38bdf8',
}

const TYPE_ICON = {
  spike:   '↑',
  drop:    '↓',
  anomaly: '⚡',
}

/* ── Helpers ──────────────────────────────────────── */
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/* ── Animation ────────────────────────────────────── */
const pop = { hidden: { opacity: 0, y: 12, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }

/* ── Custom chart tooltip ─────────────────────────── */
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-xs shadow-xl">
      <p className="text-text-muted">{label}</p>
      <p className="font-mono font-bold text-amber">{payload[0].value}</p>
    </div>
  )
}

/* ══════════════════════════════════════════════════ */
function DatasetPage() {
  const { id } = useParams()
  const [dataset, setDataset] = useState(null)
  const [snapshots, setSnapshots] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchingNow, setFetchingNow] = useState(false)
  const [scrubIndex, setScrubIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)

  // Fetch dataset info, snapshots, and events
  useEffect(() => {
    async function load() {
      try {
        const [allDs, snaps, evs] = await Promise.all([
          api.getDatasets(),
          api.getSnapshots(id),
          api.getDatasetEvents(id),
        ])
        const ds = allDs.find(d => d._id === id)
        setDataset(ds || null)
        setSnapshots(snaps)
        setScrubIndex(snaps.length - 1)
        setEvents(evs.slice(0, 10))
        setLoading(false)
      } catch (err) {
        console.error('Failed to load dataset:', err)
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Handle manual fetch
  async function handleFetchNow() {
    setFetchingNow(true)
    try {
      await api.fetchNow(id)
      // Refresh snapshots & events
      const [snaps, evs] = await Promise.all([
        api.getSnapshots(id),
        api.getDatasetEvents(id),
      ])
      setSnapshots(snaps)
      setScrubIndex(snaps.length - 1)
      setEvents(evs.slice(0, 10))
    } catch (err) {
      console.error('Manual fetch failed:', err)
    }
    setFetchingNow(false)
  }

  // Auto-play effect
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setScrubIndex(prev => {
        if (prev >= snapshots.length - 1) {
          setIsPlaying(false) // pause at end
          return prev
        }
        return prev + 1
      })
    }, 250) // Fast 250ms interval for nice demo replay
    return () => clearInterval(interval)
  }, [isPlaying, snapshots.length])

  // Sliced data based on scrubber
  const slicedSnapshots = useMemo(() => {
    if (scrubIndex === -1 || snapshots.length === 0) return snapshots
    return snapshots.slice(0, Math.min(scrubIndex + 1, snapshots.length))
  }, [snapshots, scrubIndex])

  const cutoffDate = slicedSnapshots.length > 0 ? new Date(slicedSnapshots[slicedSnapshots.length - 1].timestamp) : new Date()

  // Chart data
  const timelineData = useMemo(() => {
    return slicedSnapshots.map(s => ({
      label: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: s.value,
    }))
  }, [slicedSnapshots])

  // Distribution data (histogram of values)
  const distData = useMemo(() => {
    if (slicedSnapshots.length < 2) return []
    const values = slicedSnapshots.map(s => s.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const bucketCount = Math.min(12, Math.max(4, Math.floor(slicedSnapshots.length / 5)))
    const step = (max - min) / bucketCount || 1
    const buckets = Array(bucketCount).fill(0)
    values.forEach(v => {
      const idx = Math.min(Math.floor((v - min) / step), bucketCount - 1)
      buckets[idx]++
    })
    return buckets.map((count, i) => ({
      range: `${(min + i * step).toFixed(0)}`,
      count
    }))
  }, [slicedSnapshots])

  // Stats computed from sliced snapshots
  const stats = useMemo(() => {
    if (slicedSnapshots.length === 0) return { current: '—', change: 0, total: 0, anomalies: 0 }
    const latest = slicedSnapshots[slicedSnapshots.length - 1]
    const prev = slicedSnapshots.length > 1 ? slicedSnapshots[slicedSnapshots.length - 2] : latest
    const pct = prev.value !== 0 ? ((latest.value - prev.value) / prev.value) * 100 : 0

    // Filter anomalies up to the cutoff date
    const anomalies = events.filter(ev => ev.severity === 'high' && new Date(ev.timestamp) <= cutoffDate).length

    return { current: latest.value, change: pct, total: slicedSnapshots.length, anomalies }
  }, [slicedSnapshots, events, cutoffDate])

  const accent = dataset ? (ACCENT[dataset.category] || '#a78bfa') : '#a78bfa'

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-40">
        <div className="flex flex-col items-center gap-3 text-text-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-transparent" />
          <span className="text-sm">Loading dataset…</span>
        </div>
      </div>
    )
  }

  if (!dataset) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-40 gap-4">
        <p className="text-text-muted text-sm">Dataset not found</p>
        <Link to="/dashboard" className="rounded-lg border border-edge bg-bg-raised px-3 py-1.5 text-xs text-text-muted hover:border-bg-hover">← Back to Dashboard</Link>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-0">

      {/* ── Header ────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-edge px-8 py-5">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="rounded-lg border border-edge bg-bg-raised px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-bg-hover">←</Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}40` }} />
              <h1 className="text-lg font-bold tracking-tight">{dataset.name}</h1>
            </div>
            <p className="mt-0.5 text-sm text-text-secondary">{dataset.source_api} • {dataset.location}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFetchNow}
            disabled={fetchingNow}
            className="rounded-lg border border-edge bg-bg-raised px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-bg-hover disabled:opacity-40"
          >
            {fetchingNow ? 'Fetching…' : '⟳ Fetch Now'}
          </button>
          <a
            href={api.exportCSV(id)}
            className="rounded-lg border border-edge bg-bg-raised px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-bg-hover"
          >
            ↓ Export CSV
          </a>
        </div>
      </header>

      <div className="px-8 py-6 flex flex-col gap-6">

        {/* ── Stat Cards ──────────────────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Current Value', val: typeof stats.current === 'number' ? stats.current.toLocaleString() : stats.current, unit: dataset.unit, accent },
            { label: '24h Change',    val: `${stats.change >= 0 ? '+' : ''}${stats.change.toFixed(2)}%`, unit: '', accent: stats.change >= 0 ? '#34d399' : '#fb7185' },
            { label: 'Total Snapshots', val: String(stats.total), unit: 'records', accent: '#38bdf8' },
            { label: 'Critical Events', val: String(stats.anomalies), unit: 'detected', accent: '#fb7185' },
          ].map(s => (
            <motion.div key={s.label} variants={pop} className="card px-4 py-3.5 flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{s.label}</span>
              <span className="text-xl font-bold tabular-nums" style={{ color: s.accent }}>{s.val}</span>
              <span className="text-[10px] text-text-muted">{s.unit}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Bento Grid: Timeline + Distribution */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

          {/* Timeline chart */}
          <motion.div variants={pop} initial="hidden" animate="show" className="card flex flex-col lg:col-span-8">
            <div className="flex items-center justify-between border-b border-edge px-5 py-3.5">
              <span className="text-sm font-semibold">Timeline</span>
              <span className="text-xs text-text-muted">{snapshots.length} data points</span>
            </div>
            <div className="flex-1 p-4" style={{ minHeight: 280 }}>
              {timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={timelineData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accent} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.max(1, Math.floor(timelineData.length / 8))} />
                    <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} cursor={{ stroke: 'rgba(255,255,255,0.06)' }} />
                    <Area type="monotone" dataKey="value" stroke={accent} strokeWidth={2} fill="url(#dsGrad)" dot={false} activeDot={{ r: 4, fill: accent, stroke: '#09090b', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-text-muted">No snapshot data yet — use Fetch Now</div>
              )}
            </div>

            {/* Scrubber */}
            <div className="border-t border-edge bg-bg-raised/30 px-5 py-4 flex items-center gap-4">
              <button
                onClick={() => setIsPlaying(p => !p)}
                disabled={snapshots.length < 2}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-text-base text-bg-base hover:bg-text-muted transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPlaying ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
              </button>
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex justify-between items-center text-[10px] text-text-muted font-mono uppercase tracking-wider">
                  <span>{snapshots.length > 0 ? new Date(snapshots[0].timestamp).toLocaleDateString() : 'Start'}</span>
                  <span className="font-bold px-2 py-0.5 rounded-md bg-bg-hover" style={{ color: accent }}>
                    {slicedSnapshots.length > 0 ? new Date(slicedSnapshots[slicedSnapshots.length - 1].timestamp).toLocaleString() : 'Now'}
                  </span>
                  <span>{snapshots.length > 0 ? new Date(snapshots[snapshots.length - 1].timestamp).toLocaleDateString() : 'End'}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, snapshots.length - 1)}
                  value={scrubIndex === -1 ? Math.max(0, snapshots.length - 1) : scrubIndex}
                  onChange={(e) => {
                    setIsPlaying(false)
                    setScrubIndex(Number(e.target.value))
                  }}
                  className="w-full h-1.5 appearance-none rounded-full bg-edge outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:scale-110 transition-all cursor-pointer"
                  style={{ 
                    '--ds-accent': accent,
                    backgroundImage: `linear-gradient(${accent}, ${accent})`,
                    backgroundSize: `${snapshots.length > 1 ? ((scrubIndex === -1 ? snapshots.length - 1 : scrubIndex) / (snapshots.length - 1)) * 100 : 0}% 100%`,
                    backgroundRepeat: 'no-repeat'
                  }}
                />
                <style dangerouslySetInnerHTML={{__html:`
                  input[type=range]::-webkit-slider-thumb { background: var(--ds-accent); }
                  input[type=range]::-moz-range-thumb { background: var(--ds-accent); }
                `}} />
              </div>
            </div>
          </motion.div>

          {/* Distribution histogram */}
          <motion.div variants={pop} initial="hidden" animate="show" className="card flex flex-col lg:col-span-4">
            <div className="flex items-center justify-between border-b border-edge px-5 py-3.5">
              <span className="text-sm font-semibold">Distribution</span>
            </div>
            <div className="flex-1 p-4" style={{ minHeight: 280 }}>
              {distData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={distData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="range" tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="count" fill={accent} radius={[4, 4, 0, 0]} opacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-text-muted">Not enough data</div>
              )}
            </div>
          </motion.div>
        </div>

        {/* ── Recent Events ───────────────────── */}
        <motion.div variants={pop} initial="hidden" animate="show" className="card">
          <div className="flex items-center justify-between border-b border-edge px-5 py-3.5">
            <span className="text-sm font-semibold">Recent Events</span>
            <Link to="/events" className="text-xs font-semibold" style={{ color: accent }}>View all →</Link>
          </div>
          <div className="divide-y divide-edge-subtle">
            {events.length === 0 && (
              <div className="flex items-center justify-center py-12 text-sm text-text-muted">No events detected yet</div>
            )}
            {events.map(ev => {
              const sev = SEV_COLOR[ev.severity] || '#52525b'
              return (
                <div key={ev._id} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-bg-hover/40">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sev, boxShadow: `0 0 6px ${sev}40` }} />
                  <span className="text-sm">{TYPE_ICON[ev.type] || '•'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs text-text-primary">{ev.message}</p>
                  </div>
                  <span className="text-xs font-mono font-bold" style={{ color: ev.percentage_change >= 0 ? '#34d399' : '#fb7185' }}>
                    {ev.percentage_change >= 0 ? '+' : ''}{ev.percentage_change.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-text-muted whitespace-nowrap">{timeAgo(ev.timestamp)}</span>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* ── Dataset metadata ─────────────────── */}
        <motion.div variants={pop} initial="hidden" animate="show" className="card px-5 py-4 flex flex-wrap gap-6">
          {[
            { label: 'Category', value: dataset.category },
            { label: 'Source', value: dataset.source_api },
            { label: 'Location', value: dataset.location },
            { label: 'Unit', value: dataset.unit },
            { label: 'Fetch Interval', value: `${dataset.fetch_interval_minutes}m` },
            { label: 'Created', value: new Date(dataset.createdAt).toLocaleDateString() },
          ].map(m => (
            <div key={m.label} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{m.label}</span>
              <span className="text-xs text-text-secondary font-mono">{m.value}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  )
}

export default DatasetPage
