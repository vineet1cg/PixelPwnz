import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { api } from '../lib/api.js'

import { useTimeMachine } from '../contexts/TimeMachineContext.jsx'
import TimelineChart from '../components/charts/TimelineChart.jsx'
import Loader from '../components/ui/Loader.jsx'
import DatasetCard from '../components/ui/DatasetCard.jsx'
import { ActivitiesCard } from '../components/ui/activities-card.jsx'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card.jsx'
import { Badge } from '../components/ui/badge.jsx'
import { formatValueDisplay, timeAgoFromNow } from '../utils/format.js'

const SEVEN_D_MS = 7 * 24 * 60 * 60 * 1000

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

/* ── Animation ────────────────────────────────────── */
const pop = { hidden: { opacity: 0, y: 12, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 22 } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }

/* ══════════════════════════════════════════════════ */
function DashboardPage() {
  const navigate = useNavigate()
  const { minTime, maxTime, simulatedTime } = useTimeMachine()
  const [datasets, setDatasets] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [allSnaps, setAllSnaps] = useState({}) // id → snapshots up to simulatedTime
  const [activeCat, setActiveCat] = useState('all')
  const [activeDs, setActiveDs]   = useState(null) // selected dataset for chart
  const [chartSnaps, setChartSnaps] = useState([])
  const [loading, setLoading] = useState(true)

  const chartWindowStart = useMemo(
    () => Math.max(minTime, simulatedTime - SEVEN_D_MS),
    [minTime, simulatedTime],
  )

  // Fetch datasets + events on mount
  useEffect(() => {
    async function load() {
      try {
        const [ds, ev] = await Promise.all([api.getDatasets(), api.getEvents()])
        setDatasets(ds)
        setAllEvents(ev)
        if (ds.length) setActiveDs(ds[0])
        setLoading(false)
      } catch (err) {
        console.error('Dashboard load failed:', err)
        setLoading(false)
      }
    }
    load()
  }, [])

  // Snapshots up to scrubber time (server-side `to`) — debounced
  useEffect(() => {
    if (!datasets.length) return
    let cancelled = false
    const t = setTimeout(async () => {
      const toIso = new Date(simulatedTime).toISOString()
      try {
        const entries = await Promise.all(
          datasets.map(async (d) => {
            try {
              const snaps = await api.getSnapshots(d._id, undefined, toIso)
              return [d._id, snaps]
            } catch {
              return [d._id, []]
            }
          }),
        )
        if (!cancelled) setAllSnaps(Object.fromEntries(entries))
      } catch {
        if (!cancelled) setAllSnaps({})
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [datasets, simulatedTime])

  // Derived current metrics based on simulatedTime
  const snapCache = useMemo(() => {
    const cache = {}
    for (const [id, snaps] of Object.entries(allSnaps)) {
      const valid = snaps.filter(s => new Date(s.timestamp).getTime() <= simulatedTime)
      if (!valid.length) {
        cache[id] = { value: '—', pct: 0, ts: null, count: 0 }
        continue
      }
      const latest = valid[valid.length - 1]
      const prev = valid.length > 1 ? valid[valid.length - 2] : latest
      const pct = prev.value !== 0 ? ((latest.value - prev.value) / prev.value * 100) : 0
      cache[id] = { value: latest.value, pct, ts: latest.timestamp, count: valid.length }
    }
    return cache
  }, [allSnaps, simulatedTime])

  // Chart: windowed fetch [chartWindowStart, simulatedTime]
  useEffect(() => {
    if (!activeDs?._id) return
    let cancelled = false
    const fromIso = new Date(chartWindowStart).toISOString()
    const toIso = new Date(simulatedTime).toISOString()
    api
      .getSnapshots(activeDs._id, fromIso, toIso)
      .then((snaps) => {
        if (!cancelled) setChartSnaps(snaps)
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [activeDs?._id, chartWindowStart, simulatedTime])

  const chartData = useMemo(() => {
    return chartSnaps
      .filter((s) => new Date(s.timestamp).getTime() <= simulatedTime)
      .map((s) => ({
        label: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fullLabel: new Date(s.timestamp).toLocaleString(),
        value: s.value,
        fullTs: s.timestamp,
      }))
  }, [chartSnaps, simulatedTime])

  const chartEvents = useMemo(() => {
    if (!activeDs?._id) return []
    return allEvents.filter(
      (e) =>
        (e.dataset_id === activeDs._id || String(e.dataset_id) === String(activeDs._id)) &&
        new Date(e.timestamp).getTime() <= simulatedTime,
    )
  }, [allEvents, activeDs, simulatedTime])

  const events = useMemo(() => {
    return allEvents.filter(e => new Date(e.timestamp).getTime() <= simulatedTime)
  }, [allEvents, simulatedTime])

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

  const sevCounts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 }
    events.forEach((e) => {
      if (e.severity in c) c[e.severity] += 1
    })
    return c
  }, [events])

  const snapshotRows = useMemo(
    () => Object.values(snapCache).reduce((n, s) => n + (s.count || 0), 0),
    [snapCache],
  )

  const activeAccent = activeDs ? (CAT[activeDs.category]?.accent || '#a78bfa') : '#f59e0b'

  if (loading) return <Loader label="Loading dashboard…" className="py-40" />

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-0">

      {/* ── Page intro + live activity (header rail) ───────────── */}
      <header className="border-b border-edge px-8 py-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight">{getGreeting()}</h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Tracking <span className="font-mono text-text-primary">{stats.datasets}</span> datasets across {stats.categories} categories
            </p>
          </div>
          <div className="w-full shrink-0 lg:max-w-md xl:max-w-lg">
            <ActivitiesCard
              headerIcon={<span className="text-lg">⚡</span>}
              title="Recent activity"
              subtitle={`${events.length} events in scrubber range`}
              initialOpen={events.length > 0}
              headerAction={(
                <Link
                  to="/events"
                  className="rounded-lg border border-edge bg-bg-raised px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary transition-colors hover:border-bg-hover hover:text-text-primary"
                >
                  View all →
                </Link>
              )}
              activities={(events.slice(0, 8)).map((ev) => ({
                icon: (
                  <span className="text-base" aria-hidden>
                    {ev.severity === 'high' ? '🔴' : ev.severity === 'medium' ? '🟡' : '🔵'}
                  </span>
                ),
                title: ev.type ? String(ev.type).replaceAll('_', ' ') : 'Event',
                desc: ev.message,
                time: timeAgoFromNow(ev.timestamp),
              }))}
            />
          </div>
        </div>
      </header>

      <div className="px-8 py-6 flex flex-col gap-6">

        {/* ── KPI strip (Watermelon-style metric cards) ───────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            {
              label: 'Datasets',
              val: stats.datasets,
              hint: `${filteredDatasets.length} in current filter`,
              accent: '#f59e0b',
              icon: '📊',
            },
            {
              label: 'Events in range',
              val: stats.events,
              hint: `${snapshotRows.toLocaleString()} snapshot rows loaded`,
              accent: '#fb7185',
              icon: '⚡',
            },
            {
              label: 'Critical',
              val: stats.critical,
              hint:
                stats.events > 0
                  ? `${((stats.critical / stats.events) * 100).toFixed(0)}% of events`
                  : 'No events in range',
              accent: stats.critical > 0 ? '#fb7185' : '#34d399',
              icon: '🔴',
            },
            {
              label: 'Pipeline',
              val: 'Live',
              hint: 'Scrubber + API',
              accent: '#34d399',
              icon: '🟢',
              badge: true,
            },
          ].map((s) => (
            <motion.div key={s.label} variants={pop}>
              <Card className="h-full gap-0 border-edge bg-bg-overlay/80 py-4 shadow-none backdrop-blur-sm">
                <CardHeader className="gap-1 px-4 pb-2 pt-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-lg opacity-90" aria-hidden>{s.icon}</span>
                    {s.badge ? (
                      <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400">Live</Badge>
                    ) : null}
                  </div>
                  <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {s.label}
                  </CardDescription>
                  <CardTitle
                    className="font-mono text-2xl font-bold tabular-nums text-text-primary"
                    style={{ color: s.badge ? undefined : s.accent }}
                  >
                    {s.val}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-1 pt-0">
                  <p className="text-[11px] leading-snug text-text-muted">{s.hint}</p>
                </CardContent>
              </Card>
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

        {/* ── Dataset cards (real sparklines when data loaded) ── */}
        {filteredDatasets.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDatasets.slice(0, 6).map((ds) => {
              const cat = CAT[ds.category] || { accent: '#a78bfa' }
              const snap = snapCache[ds._id]
              const snaps = allSnaps[ds._id] || []
              const spark = snaps.length > 2 ? snaps.slice(-20).map((s) => s.value) : undefined
              return (
                <div key={ds._id} onClick={() => setActiveDs(ds)} className="cursor-pointer" role="presentation">
                  <DatasetCard
                    name={ds.name}
                    value={snap?.value != null ? formatValueDisplay(snap.value, ds.unit) : '—'}
                    unit=""
                    percentageChange={snap?.pct ?? 0}
                    timestamp={snap?.ts ? timeAgoFromNow(snap.ts) : '—'}
                    accent={cat.accent}
                    sparklineValues={spark}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* ── Main analytics grid (Watermelon-style: chart + insights rail, then table) ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* ─ Chart (primary — like ERP / e‑commerce hero charts) ─ */}
          <motion.div variants={pop} initial="hidden" animate="show" className="flex flex-col lg:col-span-8">
            <Card className="max-h-full gap-0 border-edge bg-bg-overlay/80 py-0 shadow-none backdrop-blur-sm">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-edge px-5 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: activeAccent }} />
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm font-semibold text-text-primary">
                      {activeDs?.name ?? 'Select a dataset'}
                    </CardTitle>
                    <CardDescription className="text-xs text-text-muted">
                      {chartData.length} points · event markers → event log
                    </CardDescription>
                  </div>
                </div>
                {activeDs && (
                  <Link
                    to={`/dataset/${activeDs._id}`}
                    className="shrink-0 text-xs font-semibold transition-colors hover:underline"
                    style={{ color: activeAccent }}
                  >
                    View details →
                  </Link>
                )}
              </CardHeader>
              <CardContent className="p-4" style={{ minHeight: 260 }}>
                {chartData.length > 0 ? (
                  <TimelineChart
                    data={chartData}
                    accent={activeAccent}
                    height={260}
                    events={chartEvents}
                    gradientId="dashMainGrad"
                    onEventClick={() => navigate('/events')}
                  />
                ) : (
                  <div className="flex h-[260px] items-center justify-center text-sm text-text-muted">
                    No snapshot data in this range
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* ─ Insights rail (time window + severity — like payment/ops side panels) ─ */}
          <motion.div variants={pop} initial="hidden" animate="show" className="flex flex-col gap-4 lg:col-span-4">
            <Card className="gap-0 border-edge bg-bg-overlay/80 py-0 shadow-none backdrop-blur-sm">
              <CardHeader className="border-b border-edge px-4 py-3">
                <CardTitle className="text-sm font-semibold text-text-primary">Scrubber window</CardTitle>
                <CardDescription className="text-xs text-text-muted">
                  Data bounds · move the timeline to explore
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-4 py-4">
                <div className="rounded-lg border border-edge-subtle bg-bg-raised/60 px-3 py-2 text-[11px] text-text-secondary">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Range</span>
                  <p className="mt-1 font-mono text-xs text-text-primary">
                    {new Date(minTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' — '}
                    {new Date(maxTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="rounded-lg border border-amber/20 bg-amber/5 px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Simulated</span>
                  <p className="mt-1 font-mono text-sm font-bold text-amber">
                    {new Date(simulatedTime).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 border-edge bg-bg-overlay/80 py-0 shadow-none backdrop-blur-sm">
              <CardHeader className="border-b border-edge px-4 py-3">
                <CardTitle className="text-sm font-semibold text-text-primary">Event mix</CardTitle>
                <CardDescription className="text-xs text-text-muted">By severity (in scrubber range)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-4 py-4">
                {events.length === 0 ? (
                  <p className="text-[13px] text-text-muted">No events yet</p>
                ) : (
                  ['high', 'medium', 'low'].map((key) => {
                    const count = sevCounts[key]
                    const pct = events.length ? (count / events.length) * 100 : 0
                    const color = SEV_COLOR[key]
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between text-[11px] text-text-muted">
                          <span className="capitalize">{key}</span>
                          <span className="font-mono tabular-nums text-text-secondary">{count}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-raised">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}40` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* ─ Dataset table (full width — like ERP “All employees”) ─ */}
          <motion.div variants={pop} initial="hidden" animate="show" className="flex flex-col lg:col-span-12">
            <Card className="max-h-[min(52vh,480px)] gap-0 border-edge bg-bg-overlay/80 py-0 shadow-none backdrop-blur-sm">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-edge px-5 py-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-text-primary">Datasets</CardTitle>
                  <CardDescription className="text-xs text-text-muted">
                    {filteredDatasets.length} tracked · click row to focus chart
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-edge text-text-muted">
                  Table
                </Badge>
              </CardHeader>
              <div className="grid grid-cols-12 gap-2 border-b border-edge-subtle px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                <span className="col-span-4">Name</span>
                <span className="col-span-2">Category</span>
                <span className="col-span-2 text-right">Value</span>
                <span className="col-span-2 text-right">Change</span>
                <span className="col-span-2 text-right">Updated</span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-edge-subtle">
                {filteredDatasets.map((ds) => {
                  const cat = CAT[ds.category] || { label: ds.category, accent: '#a78bfa', icon: '•' }
                  const snap = snapCache[ds._id]
                  const isActive = activeDs?._id === ds._id
                  return (
                    <div
                      key={ds._id}
                      onClick={() => setActiveDs(ds)}
                      className={`grid grid-cols-12 gap-2 px-5 py-2.5 cursor-pointer items-center text-sm transition-colors ${isActive ? 'bg-bg-hover/60' : 'hover:bg-bg-hover/30'}`}
                    >
                      <Link
                        to={`/dataset/${ds._id}`}
                        className="col-span-4 flex items-center gap-2 min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cat.accent }} />
                        <span className="truncate text-xs font-semibold text-text-primary hover:underline">{ds.name}</span>
                      </Link>
                      <span className="col-span-2">
                        <Badge
                          variant="secondary"
                          className="border-0 px-2 py-0.5 text-[9px] font-bold"
                          style={{ background: `${cat.accent}18`, color: cat.accent }}
                        >
                          {cat.label}
                        </Badge>
                      </span>
                      <span className="col-span-2 text-right font-mono text-xs text-text-secondary">
                        {snap ? formatValueDisplay(snap.value, ds.unit) : '—'}
                      </span>
                      <span
                        className="col-span-2 text-right font-mono text-xs font-bold"
                        style={{ color: snap ? (snap.pct >= 0 ? '#34d399' : '#fb7185') : '#52525b' }}
                      >
                        {snap ? `${snap.pct >= 0 ? '+' : ''}${snap.pct.toFixed(2)}%` : '—'}
                      </span>
                      <span className="col-span-2 text-right text-[10px] text-text-muted">
                        {snap?.ts ? timeAgoFromNow(snap.ts) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

export default DashboardPage
