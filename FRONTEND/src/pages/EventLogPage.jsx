import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { api } from '../lib/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'
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
  prediction: '🔮',
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
  const { user } = useAuth()
  const [allEvents, setAllEvents] = useState([])
  const [datasets, setDatasets] = useState({})
  const [filter, setFilter] = useState('all')
  const [datasetFilter, setDatasetFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [explanations, setExplanations] = useState({})
  const [loading, setLoading] = useState(true)
  const [flagging, setFlagging] = useState(null) // Track which event is being flagged
  const [requestingAI, setRequestingAI] = useState(null) // Track which event is requesting AI
  const [limit, setLimit] = useState(50) // Pagination limit

  const datasetOptions = useMemo(() => Object.values(datasets), [datasets])

  // Reset pagination when filters change
  useEffect(() => {
    setLimit(50)
  }, [filter, datasetFilter, dateFrom, dateTo])

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

  // Paginated list for rendering
  const paginated = useMemo(() => {
    return filtered.slice(0, limit)
  }, [filtered, limit])

  // Get AI explanation
  async function handleExplain(eventId) {
    console.log('Requesting explanation for event:', eventId)
    setExplanations(p => ({ ...p, [eventId]: 'Loading…' }))
    try {
      const data = await api.explainEvent(eventId)
      setAllEvents(prev => prev.map(ev => ev._id === eventId ? data.event : ev))
      setExplanations(p => ({ ...p, [eventId]: null }))
    } catch (error) {
      console.error('Failed to get explanation:', error)
      setExplanations(p => ({ ...p, [eventId]: 'Explanation unavailable' }))
    }
  }

  // Flag/unflag an event
  async function handleFlag(eventId, e) {
    e.stopPropagation()
    if (!user) return
    setFlagging(eventId)
    try {
      // Toggle flag without requesting AI
      await api.flagEvent(eventId, false)
      // Refresh events to get updated flagged_count and user_flagged status
      const updated = await api.getEvents()
      setAllEvents(updated)
    } catch (error) {
      console.error('Failed to flag event:', error)
    } finally {
      setFlagging(null)
    }
  }

  // Flag event and request AI analysis
  async function handleFlagWithAI(eventId, e) {
    e.stopPropagation()
    if (!user) return
    setRequestingAI(eventId)
    try {
      // Flag and request AI analysis
      await api.flagEvent(eventId, true)
      // Refresh events
      const updated = await api.getEvents()
      setAllEvents(updated)
    } catch (error) {
      console.error('Failed to flag event with AI:', error)
    } finally {
      setRequestingAI(null)
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
      <header className="flex items-center justify-end border-b border-edge px-8 py-4 gap-3">
        {user && (
          <Button variant="outline" size="sm" onClick={() => {
              api.triggerForecast().then(() => alert('AI Forecast cycle triggered and running securely in the background!'))
          }} className="text-purple-400 border-purple-500/20 hover:text-purple-300 hover:border-purple-500/50 bg-purple-500/5 hover:bg-purple-500/10 transition-colors hidden md:flex">
            <span className="mr-2">🔮</span> Run AI Forecast
          </Button>
        )}
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
            <span className="col-span-2">Dataset</span>
            <span className="col-span-2 text-right">Change</span>
            <span className="col-span-2">Time</span>
            <span className="col-span-2">Flags</span>
            <span className="col-span-1 text-right">Actions</span>
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
            {paginated.map(ev => {
              const sev = SEV[ev.severity] || SEV.low
              const ds = datasets[ev.dataset_id] ?? datasets[String(ev.dataset_id)]
              const isExpanded = expanded === ev._id
              const accent = dsAccent(ev.dataset_id)
              const pctAbs = Math.abs(ev.percentage_change)
              const pctSign = ev.percentage_change >= 0 ? '+' : '-'
              return (
                <motion.div
                  key={ev._id}
                  variants={pop}
                  className="border-b border-edge-subtle transition-colors hover:bg-bg-hover/40"
                >
                  {/* Main row */}
                  <div
                    className="grid grid-cols-12 gap-2 px-5 py-3 cursor-pointer items-center text-sm transition-all"
                    style={{
                      background: ev.is_significant ? 'rgba(251,113,133,0.04)' : undefined,
                      borderLeft: ev.is_significant ? `3px solid ${sev.color}` : 'none'
                    }}
                    onClick={() => {
                      setExpanded(isExpanded ? null : ev._id)
                      if (!isExpanded) handleExplain(ev._id)
                    }}
                  >
                    <span className="col-span-1 flex items-center gap-2">
                      {ev.is_significant && (
                        <span className="text-lg" title="Significant Change">⭐</span>
                      )}
                      <span className="h-2 w-2 rounded-full" style={{ background: sev.color, boxShadow: `0 0 6px ${sev.color}40` }} />
                      <span className="text-[10px] font-semibold" style={{ color: sev.color }}>{sev.label}</span>
                    </span>
                    <span className="col-span-2 flex items-center gap-1.5 font-mono text-xs">
                      <span className="text-sm">{TYPE_ICON[ev.type] || '•'}</span>
                      <span className="capitalize text-text-secondary">{ev.type}</span>
                    </span>
                    <span className="col-span-2 flex items-center gap-2">
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
                    <span className="col-span-2 text-xs text-text-muted">
                      {ev.type === 'prediction' && ev.target_timestamp ? (
                        <span className="text-purple-400/90 font-medium whitespace-nowrap" title="Estimated Arrival Time">Est: {formatDate(ev.target_timestamp)}</span>
                      ) : (
                        formatDate(ev.timestamp)
                      )}
                    </span>
                    <span className="col-span-2 flex items-center gap-2">
                      {ev.type === 'prediction' && ev.ai_confidence && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20" title={`AI Confidence`}>
                          {ev.ai_confidence}% CONF
                        </span>
                      )}
                      {ev.flagged_count > 0 && (
                        <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-amber-500/10 text-amber-600" title={`${ev.flagged_count} user flags`}>
                          🚩 {ev.flagged_count}
                        </span>
                      )}
                      {ev.type !== 'prediction' && (ev.ai_reason || ev.ai_action || ev.ai_impact) && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-emerald-500/10 text-emerald-400" title="Analyzed by AI Context Engine">
                          ⚡ AI
                        </span>
                      )}
                    </span>
                    <span className="col-span-1 flex justify-end">
                      {user && (
                        <button
                          onClick={(e) => handleFlag(ev._id, e)}
                          disabled={flagging === ev._id}
                          className="text-sm transition-all disabled:opacity-50"
                          title="Flag this event"
                        >
                          {flagging === ev._id ? '⏳' : '🚩'}
                        </button>
                      )}
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

                          {/* AI Insights Block */}
                          {(ev.ai_reason || ev.ai_action || ev.ai_impact) && (
                            <div className="mt-3 border-t border-edge-subtle pt-3">
                              <span className="flex items-center gap-2 text-[10px] uppercase text-text-muted font-semibold">
                                <span>⚡</span> Significant Change Analysis
                              </span>
                              <div className="mt-3 grid grid-cols-1 gap-3">
                                {/* Reason */}
                                {ev.ai_reason && (
                                  <div className="card-flat px-3 py-2.5 border-l-2" style={{ borderColor: sev.color }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: sev.color }}>Why it happened</p>
                                    <p className="mt-1 text-xs text-text-secondary leading-relaxed">{ev.ai_reason}</p>
                                  </div>
                                )}
                                {/* Action */}
                                {ev.ai_action && (
                                  <div className="card-flat px-3 py-2.5 border-l-2" style={{ borderColor: '#f59e0b' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">What to do</p>
                                    <p className="mt-1 text-xs text-text-secondary leading-relaxed">{ev.ai_action}</p>
                                  </div>
                                )}
                                {/* Impact */}
                                {ev.ai_impact && (
                                  <div className="card-flat px-3 py-2.5 border-l-2" style={{ borderColor: '#38bdf8' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-sky-500">Future impact</p>
                                    <p className="mt-1 text-xs text-text-secondary leading-relaxed">{ev.ai_impact}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Flag options for user */}
                          {user && (
                            <div className="mt-3 border-t border-edge-subtle pt-3 flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleFlag(ev._id, e)}
                                disabled={flagging === ev._id}
                                className="flex items-center gap-2"
                              >
                                🚩 {flagging === ev._id ? 'Flagging...' : 'Flag Event'}
                              </Button>
                              {!(ev.ai_reason || ev.ai_action || ev.ai_impact) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => handleFlagWithAI(ev._id, e)}
                                  disabled={requestingAI === ev._id}
                                  className="flex items-center gap-2"
                                >
                                  ⚡ {requestingAI === ev._id ? 'Analyzing...' : 'Flag & Analyze'}
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Standard AI Explanation Request Block */}
                          {!(ev.ai_reason || ev.ai_action || ev.ai_impact) && (
                            <div className="card-flat px-3 py-2 mt-3">
                              <span className="text-[10px] uppercase text-text-muted">AI Analysis</span>
                              <div className="mt-1 text-xs text-text-secondary">
                                {explanations[ev._id] === 'Loading…' && (
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                    <span>Analyzing event patterns...</span>
                                  </div>
                                )}
                                {explanations[ev._id] === 'Explanation unavailable' && (
                                  <div className="text-rose-500">Failed to analyze. Please try again.</div>
                                )}
                                {!explanations[ev._id] && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleExplain(ev._id); }}
                                    className="flex items-center gap-2"
                                  >
                                    <span>🤖</span> Analyze Anomaly
                                  </Button>
                                )}
                                {explanations[ev._id] && explanations[ev._id] !== 'Loading…' && explanations[ev._id] !== 'Explanation unavailable' && (
                                  <p>{explanations[ev._id]}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Load More Button */}
          {filtered.length > limit && (
            <div className="flex justify-center p-4 border-t border-edge-subtle">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setLimit(p => p + 50)}
              >
                Load More ({filtered.length - limit} remaining)
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}

export default EventLogPage
