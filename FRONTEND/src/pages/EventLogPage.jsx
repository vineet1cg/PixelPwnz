import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { api } from '../lib/api.js'
import BeforeAfterChart from '../components/BeforeAfterChart.jsx'
import Loader from '../components/ui/Loader.jsx'
import { Button } from '../components/ui/button.jsx'
import { Input } from '../components/ui/input.jsx'
import { Label } from '../components/ui/label.jsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select.jsx'
import { useTimeMachine } from '../contexts/TimeMachineContext.jsx'

/* ── Severity palette ─────────────────────────────── */
const SEV = {
  high:   { label: 'Critical', color: '#fb7185', bg: 'rgba(251,113,133,0.08)', icon: '🔴' },
  medium: { label: 'Warning',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: '🟡' },
  low:    { label: 'Info',     color: '#38bdf8', bg: 'rgba(56,189,248,0.08)', icon: '🔵' },
}

/* ── Type icons ───────────────────────────────────── */
const TYPE_ICON = {
  spike:   '↑',
  drop:    '↓',
  anomaly: '⚡',
  update:  '⟳',
}

/* ── Helpers ──────────────────────────────────────── */
function formatDate(iso) {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ── Animation ────────────────────────────────────── */
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }
const pop = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } } }

/* ══════════════════════════════════════════════════ */
function EventLogPage() {
  const { simulatedTime } = useTimeMachine()
  const [allEvents, setAllEvents] = useState([])
  const [datasets, setDatasets] = useState({})
  const [filter, setFilter] = useState('all')
  const [datasetFilter, setDatasetFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [explanations, setExplanations] = useState({})
  const [loading, setLoading] = useState(true)

  const datasetOptions = useMemo(() => Object.values(datasets), [datasets])

  // Fetch events + datasets on mount
  useEffect(() => {
    async function load() {
      try {
        const [ev, ds] = await Promise.all([api.getEvents(), api.getDatasets()])
        setAllEvents(ev)
        // Create id→dataset lookup
        const dsMap = {}
        ds.forEach(d => {
          dsMap[d._id] = d
          if (d._id != null) dsMap[String(d._id)] = d
        })
        setDatasets(dsMap)
        setLoading(false)
      } catch (err) {
        console.error('Failed to load events:', err)
        setLoading(false)
      }
    }
    load()
  }, [])

  // Filter events by simulatedTime
  const events = useMemo(() => {
    return allEvents.filter(e => new Date(e.timestamp).getTime() <= simulatedTime)
  }, [allEvents, simulatedTime])

  // Severity counts
  const counts = useMemo(() => {
    const c = { all: events.length, high: 0, medium: 0, low: 0 }
    events.forEach(e => { c[e.severity] = (c[e.severity] || 0) + 1 })
    return c
  }, [events])

  // Filtered list (severity + dataset + calendar range)
  const filtered = useMemo(() => {
    let list = filter === 'all' ? events : events.filter((e) => e.severity === filter)
    if (datasetFilter !== 'all')
      list = list.filter((e) => String(e.dataset_id) === datasetFilter)
    if (dateFrom) {
      const fromMs = new Date(dateFrom).getTime()
      list = list.filter((e) => new Date(e.timestamp).getTime() >= fromMs)
    }
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      list = list.filter((e) => new Date(e.timestamp).getTime() <= end.getTime())
    }
    return list
  }, [events, filter, datasetFilter, dateFrom, dateTo])

  // Get AI explanation
  async function handleExplain(eventId) {
    if (explanations[eventId]) return
    setExplanations(p => ({ ...p, [eventId]: 'Loading…' }))
    try {
      const { explanation } = await api.explainEvent(eventId)
      setExplanations(p => ({ ...p, [eventId]: explanation }))
    } catch {
      setExplanations(p => ({ ...p, [eventId]: 'Explanation unavailable' }))
    }
  }

  // Dataset accent color
  function dsAccent(dsId) {
    const ds = datasets[dsId] ?? datasets[String(dsId)]
    if (!ds) return '#a78bfa'
    const cat = ds.category
    if (cat === 'crypto') return '#f59e0b'
    if (cat === 'air_quality') return '#fb7185'
    if (cat === 'weather') return '#38bdf8'
    return '#a78bfa'
  }

  if (loading) return <Loader label="Loading events…" className="py-40" />

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-0">

      {/* ── Toolbar (title in Navbar) ───────────────────── */}
      <header className="flex items-center justify-end border-b border-edge px-8 py-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/dashboard">← Dashboard</Link>
        </Button>
      </header>

      <div className="px-8 py-6 flex flex-col gap-4">

        {/* ── Dataset + date filters ───────────── */}
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-dataset">Dataset</Label>
            <Select value={datasetFilter} onValueChange={setDatasetFilter}>
              <SelectTrigger id="event-dataset" className="min-w-[220px]">
                <SelectValue placeholder="All datasets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All datasets</SelectItem>
                {datasetOptions.map((d) => (
                  <SelectItem key={d._id} value={String(d._id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-from">From</Label>
            <Input
              id="event-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[11.5rem]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-to">To</Label>
            <Input
              id="event-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[11.5rem]"
            />
          </div>
          {(dateFrom || dateTo || datasetFilter !== 'all') && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
                setDatasetFilter('all')
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* ── Filter Chips ─────────────────────── */}
        <div className="flex flex-wrap gap-2">
          {['all', 'high', 'medium', 'low'].map(key => {
            const active = filter === key
            const sev = SEV[key]
            const label = key === 'all' ? 'All' : sev?.label
            const accent = key === 'all' ? '#a1a1aa' : sev?.color
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums transition-all duration-150"
                style={{
                  borderColor: active ? accent : '#27272a',
                  background: active ? `${accent}12` : 'transparent',
                  color: active ? accent : '#71717a',
                }}
              >
                {label} <span className="ml-1 font-mono opacity-70">{counts[key]}</span>
              </button>
            )
          })}
        </div>

        {/* ── Events Table ─────────────────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 border-b border-edge px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            <span className="col-span-1">Severity</span>
            <span className="col-span-2">Type</span>
            <span className="col-span-3">Dataset</span>
            <span className="col-span-2 text-right">Change</span>
            <span className="col-span-2">Time</span>
            <span className="col-span-2 text-right">Values</span>
          </div>

          <AnimatePresence mode="popLayout">
            {filtered.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-16 text-sm text-text-muted"
              >
                No events match this filter
              </motion.div>
            )}
            {filtered.map(ev => {
              const sev = SEV[ev.severity] || SEV.low
              const ds = datasets[ev.dataset_id] ?? datasets[String(ev.dataset_id)]
              const isExpanded = expanded === ev._id
              const accent = dsAccent(ev.dataset_id)
              const pctAbs = Math.abs(ev.percentage_change).toFixed(1)
              const pctSign = ev.percentage_change >= 0 ? '+' : '-'
              return (
                <motion.div
                  key={ev._id}
                  variants={pop}
                  layout
                  className="border-b border-edge-subtle transition-colors hover:bg-bg-hover/40"
                >
                  {/* Main row */}
                  <div
                    className="grid grid-cols-12 gap-2 px-5 py-3 cursor-pointer items-center text-sm"
                    onClick={() => {
                      setExpanded(isExpanded ? null : ev._id)
                      if (!isExpanded) handleExplain(ev._id)
                    }}
                  >
                    <span className="col-span-1 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: sev.color, boxShadow: `0 0 6px ${sev.color}40` }} />
                      <span className="text-[10px] font-semibold" style={{ color: sev.color }}>{sev.label}</span>
                    </span>
                    <span className="col-span-2 flex items-center gap-1.5 font-mono text-xs">
                      <span className="text-sm">{TYPE_ICON[ev.type] || '•'}</span>
                      <span className="capitalize text-text-secondary">{ev.type}</span>
                    </span>
                    <span className="col-span-3 flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: `${accent}14`, color: accent }}
                      >
                        {ds?.name || 'Unknown'}
                      </span>
                    </span>
                    <span
                      className="col-span-2 text-right font-mono text-xs font-bold"
                      style={{ color: ev.percentage_change >= 0 ? '#34d399' : '#fb7185' }}
                    >
                      {pctSign}{pctAbs}%
                    </span>
                    <span className="col-span-2 text-xs text-text-muted">{formatDate(ev.timestamp)}</span>
                    <span className="col-span-2 text-right font-mono text-[11px] text-text-secondary">
                      {ev.previous_value != null ? `${ev.previous_value} → ${ev.current_value}` : `${ev.current_value}`}
                    </span>
                  </div>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-3 border-t border-edge-subtle bg-bg-hover/30 px-5 py-4">
                          {/* Message */}
                          <p className="text-xs text-text-secondary">{ev.message}</p>

                          {/* Before / After cards */}
                          {ev.previous_value != null && (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="card-flat px-3 py-2">
                                <span className="text-[10px] uppercase text-text-muted">Before</span>
                                <p className="mt-1 text-lg font-bold tabular-nums">{ev.previous_value}</p>
                              </div>
                              <div className="card-flat px-3 py-2" style={{ borderColor: `${sev.color}40` }}>
                                <span className="text-[10px] uppercase text-text-muted">After</span>
                                <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: sev.color }}>{ev.current_value}</p>
                              </div>
                            </div>
                          )}

                          {/* Mini Context Chart */}
                          <div className="card-flat px-3 py-2 mt-1">
                            <span className="flex items-center gap-2 text-[10px] uppercase text-text-muted">
                              Context — 7d before / 7d after
                            </span>
                            <BeforeAfterChart datasetId={ev.dataset_id} eventTime={ev.timestamp} color={sev.color} />
                          </div>

                          {/* AI Explanation */}
                          <div className="card-flat px-3 py-2">
                            <span className="text-[10px] uppercase text-text-muted">AI Analysis</span>
                            <p className="mt-1 text-xs text-text-secondary">
                              {explanations[ev._id] || 'Click to load explanation…'}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default EventLogPage
