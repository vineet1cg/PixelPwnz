import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { api } from '../lib/api.js'
import Loader from '../components/ui/Loader.jsx'
import { Button } from '../components/ui/button.jsx'
import { Input } from '../components/ui/input.jsx'
import BeforeAfterChart from '../components/BeforeAfterChart.jsx'

const SEV = {
  high:   { label: 'Critical', color: '#fb7185' },
  medium: { label: 'Warning',  color: '#f59e0b' },
  low:    { label: 'Info',     color: '#38bdf8' },
}

export default function FlaggedEventsPage() {
  const [events, setEvents] = useState([])
  const [datasets, setDatasets] = useState({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  
  // Track note states independently so we can type without lagging
  const [notes, setNotes] = useState({})
  const [savingNote, setSavingNote] = useState(null)
  
  // AI Explanation State
  const [explanations, setExplanations] = useState({})

  useEffect(() => {
    async function load() {
      try {
        const [evs, dss] = await Promise.all([api.getFlaggedEvents(), api.getDatasets()])
        setEvents(evs)
        
        const dsMap = {}
        dss.forEach(d => { dsMap[d._id] = d })
        setDatasets(dsMap)
        
        // initialize notes
        const tempNotes = {}
        evs.forEach(e => { tempNotes[e._id] = e.user_note || '' })
        setNotes(tempNotes)
      } catch(err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleRemoveFlag(id, e) {
    if(e) e.stopPropagation();
    try {
      await api.flagEvent(id, false)
      setEvents(events.filter(ev => ev._id !== id))
    } catch(err) {
      console.error(err)
    }
  }

  async function handleSaveNote(id) {
    setSavingNote(id)
    try {
      await api.updateEventNote(id, notes[id])
      const evs = await api.getFlaggedEvents()
      setEvents(evs)
    } catch(err) {
      console.error(err)
    } finally {
      setSavingNote(null)
    }
  }

  async function handleExplain(id, e) {
    if (e) e.stopPropagation()
    setExplanations({ ...explanations, [id]: 'Loading…' })
    try {
      const data = await api.explainEvent(id)
      setEvents(prev => prev.map(ev => ev._id === id ? data.event : ev))
      setExplanations({ ...explanations, [id]: null })
    } catch (err) {
      setExplanations({ ...explanations, [id]: 'Failed to load explanation.' })
    }
  }

  if (loading) return <Loader label="Loading your flags..." className="py-20" />

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">My Flags</h1>
        <p className="text-sm text-text-secondary mt-1">Manage and tag your personally flagged anomalies.</p>
      </div>

      {events.length === 0 ? (
        <div className="card p-12 text-center text-text-muted">You haven't flagged any events yet. Head over to the Event Log to start flagging!</div>
      ) : (
        <div className="card overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 border-b border-edge px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted bg-bg-raised/50">
            <span className="col-span-2">Severity</span>
            <span className="col-span-3">Dataset</span>
            <span className="col-span-2">Change</span>
            <span className="col-span-2">Time</span>
            <span className="col-span-3 text-right">Actions</span>
          </div>

          {events.map((ev) => {
            const sev = SEV[ev.severity] || SEV.low
            const ds = datasets[ev.dataset_id]
            const isExpanded = expanded === ev._id
            return (
              <div key={ev._id} className="border-b border-edge-subtle last:border-0 hover:bg-bg-hover/40 transition-colors">
                <div 
                  className="grid grid-cols-12 gap-2 px-5 py-4 cursor-pointer items-center text-sm"
                  onClick={() => setExpanded(isExpanded ? null : ev._id)}
                >
                  <span className="col-span-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: sev.color }} />
                    <span style={{ color: sev.color }} className="font-semibold text-xs">{sev.label}</span>
                  </span>
                  <span className="col-span-3 flex items-center gap-2 text-text-primary font-medium">
                    <span className="truncate">{ds?.name || 'Unknown'}</span>
                    {ev.type === 'prediction' ? (
                      <span className="flex items-center gap-1 shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20" title={`AI Confidence`}>
                        🔮 {ev.ai_confidence}% CONF
                      </span>
                    ) : (ev.ai_reason || ev.ai_action || ev.ai_impact) ? (
                      <span className="flex items-center gap-1 shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400" title="Analyzed by AI Context Engine">
                        ⚡ AI
                      </span>
                    ) : null}
                  </span>
                  <span className="col-span-2 font-mono" style={{ color: ev.percentage_change >= 0 ? '#34d399' : '#fb7185' }}>
                    {ev.percentage_change >= 0 ? '+' : ''}{ev.percentage_change}%
                  </span>
                  <span className="col-span-2 text-xs text-text-muted">
                    {ev.type === 'prediction' && ev.target_timestamp ? (
                      <span className="text-purple-400/90 font-medium whitespace-nowrap" title="Estimated Arrival Time">Est: {new Date(ev.target_timestamp).toLocaleDateString()}</span>
                    ) : (
                      new Date(ev.timestamp).toLocaleDateString()
                    )}
                  </span>
                  <span className="col-span-3 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={(e) => handleRemoveFlag(ev._id, e)} className="text-text-muted hover:text-rose-500">
                      Unflag
                    </Button>
                  </span>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{height: 0, opacity:0}} 
                      animate={{height: 'auto', opacity:1}} 
                      exit={{height: 0, opacity:0}}
                      className="overflow-hidden bg-bg-hover/20"
                    >
                      <div className="p-5 border-t border-edge-subtle">
                        <p className="mb-5 text-sm text-text-secondary leading-relaxed max-w-3xl">{ev.message}</p>
                        
                        <div className="mb-6 flex flex-col max-w-md">
                          <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-2">Custom Tag / Note</label>
                          <div className="flex gap-2">
                            <Input 
                              value={notes[ev._id] || ''} 
                              onChange={(e) => setNotes({...notes, [ev._id]: e.target.value})}
                              placeholder="Add a label to this anomaly..."
                              className="bg-bg-base border-edge focus:border-emerald/50"
                            />
                            <Button 
                              variant="outline" 
                              onClick={() => handleSaveNote(ev._id)}
                              disabled={savingNote === ev._id}
                              className="shrink-0"
                              style={{ borderColor: notes[ev._id] !== ev.user_note ? '#f59e0b' : undefined }}
                            >
                              {savingNote === ev._id ? 'Saving...' : 'Save Tag'}
                            </Button>
                          </div>
                          {notes[ev._id] !== ev.user_note && (
                            <span className="text-[10px] text-amber-500/80 mt-1.5 ml-1 font-semibold">Unsaved changes!</span>
                          )}
                        </div>

                        <div className="card-flat px-4 py-3 mt-1 w-full max-w-4xl">
                          <span className="flex items-center gap-2 text-[10px] uppercase text-text-muted font-bold tracking-wider mb-3">
                            Contextual Snapshot
                          </span>
                          <BeforeAfterChart datasetId={ev.dataset_id} eventTime={ev.timestamp} color={sev.color} />
                        </div>

                        {/* AI Insights */}
                        {(ev.ai_reason || ev.ai_action || ev.ai_impact) && (
                          <div className="mt-5 border-t border-edge-subtle pt-5 w-full max-w-4xl">
                            <span className="flex items-center gap-2 text-[10px] uppercase text-text-muted font-bold tracking-wider mb-3">
                              <span>⚡</span> Significant Change Analysis
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {/* Reason */}
                              {ev.ai_reason && (
                                <div className="card-flat px-4 py-3 border-l-2" style={{ borderColor: sev.color }}>
                                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: sev.color }}>Why it happened</p>
                                  <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">{ev.ai_reason}</p>
                                </div>
                              )}
                              {/* Action */}
                              {ev.ai_action && (
                                <div className="card-flat px-4 py-3 border-l-2" style={{ borderColor: '#f59e0b' }}>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">What to do</p>
                                  <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">{ev.ai_action}</p>
                                </div>
                              )}
                              {/* Impact */}
                              {ev.ai_impact && (
                                <div className="card-flat px-4 py-3 border-l-2" style={{ borderColor: '#38bdf8' }}>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-500">Future impact</p>
                                  <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">{ev.ai_impact}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Standard AI Explanation Request Block */}
                        {!(ev.ai_reason || ev.ai_action || ev.ai_impact) && (
                          <div className="mt-5 border-t border-edge-subtle pt-5 w-full max-w-4xl">
                            <span className="flex items-center gap-2 text-[10px] uppercase text-text-muted font-bold tracking-wider mb-3">
                              <span>🤖</span> AI Context Engine
                            </span>
                            
                            {explanations[ev._id] === 'Loading…' ? (
                              <div className="flex items-center gap-2 text-xs text-text-secondary w-fit px-4 py-3 rounded-md bg-bg-hover">
                                <div className="w-2 h-2 bg-emerald rounded-full animate-pulse"></div>
                                <span>Analyzing spatial and temporal markers...</span>
                              </div>
                            ) : explanations[ev._id] === 'Failed to load explanation.' ? (
                              <div className="text-rose-500 text-xs mt-1">Failed to analyze. Please try again.</div>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={(e) => handleExplain(ev._id, e)}
                                className="flex items-center gap-2 text-text-muted hover:text-emerald hover:border-emerald/50"
                              >
                                <span>⚡</span> Analyze this Anomaly
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
