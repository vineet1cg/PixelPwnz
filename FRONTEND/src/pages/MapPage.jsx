import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../lib/api.js'

/* ── Category config ──────────────────────────────── */
const CAT = {
  crypto:      { label: 'Crypto',      accent: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '📈' },
  air_quality: { label: 'Air Quality', accent: '#fb7185', bg: 'rgba(251,113,133,0.15)', icon: '🌫️' },
  weather:     { label: 'Weather',     accent: '#38bdf8', bg: 'rgba(56,189,248,0.15)',  icon: '🌡️' },
  forex:       { label: 'Forex',       accent: '#a78bfa', bg: 'rgba(167,139,250,0.15)', icon: '💱' },
}

/* ── Known coordinates for data sources ───────────── */
const COORDS = {
  'delhi':     { lat: 28.6139, lon: 77.2090 },
  'mumbai':    { lat: 19.0760, lon: 72.8777 },
  'kolkata':   { lat: 22.5726, lon: 88.3639 },
  'chennai':   { lat: 13.0827, lon: 80.2707 },
  'bangalore': { lat: 12.9716, lon: 77.5946 },
  'hyderabad': { lat: 17.3850, lon: 78.4867 },
  'ahmedabad': { lat: 23.0225, lon: 72.5714 },
  'pune':      { lat: 18.5204, lon: 73.8567 },
  'jaipur':    { lat: 26.9124, lon: 75.7873 },
  'lucknow':   { lat: 26.8467, lon: 80.9462 },
  'new york':  { lat: 40.7128, lon: -74.0060 },
  'new-york':  { lat: 40.7128, lon: -74.0060 },
  'london':    { lat: 51.5074, lon: -0.1278 },
  'tokyo':     { lat: 35.6762, lon: 139.6503 },
  'dubai':     { lat: 25.2048, lon: 55.2708 },
  'sydney':    { lat: -33.8688, lon: 151.2093 },
  'singapore': { lat: 1.3521,  lon: 103.8198 },
  'paris':     { lat: 48.8566, lon: 2.3522 },
  'beijing':   { lat: 39.9042, lon: 116.4074 },
  'los angeles':{ lat: 34.0522, lon: -118.2437 },
  'chicago':   { lat: 41.8781, lon: -87.6298 },
}

/* ── Helpers ──────────────────────────────────────── */
function formatValue(v, unit) {
  if (v == null) return '—'
  if (unit === 'USD') return `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  return `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/* ── Map zoom/fly component ──────────────────────── */
function FlyToMarker({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo(center, 8, { duration: 1.2 })
  }, [center, map])
  return null
}

/* ══════════════════════════════════════════════════ */
function MapPage() {
  const [datasets, setDatasets] = useState([])
  const [snapCache, setSnapCache] = useState({})
  const [activeCat, setActiveCat] = useState('all')
  const [selectedDs, setSelectedDs] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sideSearch, setSideSearch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const ds = await api.getDatasets()
        setDatasets(ds)
        setLoading(false)

        // Background: fetch latest snapshot for each
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
        console.error('Map load failed:', err)
        setLoading(false)
      }
    }
    load()
  }, [])

  // Datasets that have geo coordinates
  const geoDatasets = useMemo(() => {
    return datasets.filter(ds => {
      if (ds.category === 'crypto' || ds.category === 'forex') return false
      const loc = ds.location?.toLowerCase().replace(/, india$/i, '').trim()
      return loc && COORDS[loc]
    }).map(ds => {
      const loc = ds.location?.toLowerCase().replace(/, india$/i, '').trim()
      const coords = COORDS[loc]
      return { ...ds, coords }
    })
  }, [datasets])

  // Category counts
  const categories = useMemo(() => {
    const cats = {}
    datasets.forEach(d => {
      if (!cats[d.category]) cats[d.category] = []
      cats[d.category].push(d)
    })
    return cats
  }, [datasets])

  // Filtered geo datasets for map
  const filteredGeo = useMemo(() => {
    if (activeCat === 'all') return geoDatasets
    return geoDatasets.filter(d => d.category === activeCat)
  }, [geoDatasets, activeCat])

  // Filtered datasets for sidebar
  const sidebarDatasets = useMemo(() => {
    let list = activeCat === 'all' ? datasets : datasets.filter(d => d.category === activeCat)
    if (sideSearch.trim()) {
      const q = sideSearch.toLowerCase()
      list = list.filter(d => d.name.toLowerCase().includes(q) || d.location?.toLowerCase().includes(q))
    }
    return list
  }, [datasets, activeCat, sideSearch])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-40">
        <div className="flex flex-col items-center gap-3 text-text-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-transparent" />
          <span className="text-sm">Loading map data…</span>
        </div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">

      {/* ── Header ────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-edge px-8 py-5 shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Geographic Data Map</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {filteredGeo.length} location-based markers • {datasets.length} total datasets
          </p>
        </div>
        <Link to="/dashboard" className="rounded-lg border border-edge bg-bg-raised px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-bg-hover hover:text-text-primary">
          ← Dashboard
        </Link>
      </header>

      {/* ── Category Filter Bar ──────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-edge px-8 py-3 shrink-0">
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
                background: active ? cfg.bg : 'transparent',
                color: active ? cfg.accent : '#71717a',
              }}
            >
              {cfg.icon} {cfg.label} <span className="ml-1 font-mono opacity-60">{count}</span>
            </button>
          )
        })}

        <div className="ml-auto flex items-center gap-2 text-[10px] text-text-muted">
          {Object.entries(CAT)
            .filter(([k]) => k !== 'crypto' && k !== 'forex')
            .map(([k, cfg]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: cfg.accent }} />
                {cfg.label}
              </span>
            ))}
        </div>
      </div>

      {/* ── Main content: Map + Sidebar ───────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Leaflet Map ─────────────────────── */}
        <div className="flex-1 relative">
          <MapContainer
            center={[22, 78]}
            zoom={4}
            minZoom={2}
            maxZoom={16}
            zoomControl={false}
            className="h-full w-full"
            style={{ background: '#09090b' }}
          >
            {/* CartoDB Dark Matter tiles */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              subdomains="abcd"
            />

            {flyTarget && <FlyToMarker center={flyTarget} />}

            {/* Data markers */}
            {filteredGeo.map(ds => {
              const cat = CAT[ds.category] || { accent: '#a78bfa' }
              const snap = snapCache[ds._id]
              const isSelected = selectedDs === ds._id
              return (
                <CircleMarker
                  key={ds._id}
                  center={[ds.coords.lat, ds.coords.lon]}
                  radius={isSelected ? 10 : 7}
                  pathOptions={{
                    color: cat.accent,
                    fillColor: cat.accent,
                    fillOpacity: isSelected ? 0.9 : 0.6,
                    weight: isSelected ? 3 : 2,
                    opacity: 0.8,
                  }}
                  eventHandlers={{
                    click: () => {
                      setSelectedDs(ds._id)
                      setFlyTarget([ds.coords.lat, ds.coords.lon])
                    },
                  }}
                >
                  <Popup>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", minWidth: 180 }}>
                      <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.accent, display: 'inline-block' }} />
                        <strong style={{ fontSize: 13, color: '#fafafa' }}>{ds.name}</strong>
                      </div>
                      <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 4 }}>
                        {ds.source_api} • {ds.location}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: cat.accent }}>
                          {snap ? formatValue(snap.value, ds.unit) : '—'}
                        </span>
                        {snap?.pct != null && (
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                            fontWeight: 700,
                            color: snap.pct >= 0 ? '#34d399' : '#fb7185',
                          }}>
                            {snap.pct >= 0 ? '+' : ''}{snap.pct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                      {snap?.ts && (
                        <div style={{ fontSize: 10, color: '#52525b', marginTop: 4 }}>
                          Updated {timeAgo(snap.ts)} • {snap.count} snapshots
                        </div>
                      )}
                      <a
                        href={`/dataset/${ds._id}`}
                        style={{ display:'inline-block', marginTop: 8, fontSize: 11, color: cat.accent, textDecoration: 'none', fontWeight: 600 }}
                      >
                        View Details →
                      </a>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>

          {/* Floating info overlay */}
          <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-none">
            <span className="pointer-events-auto rounded-lg bg-bg-base/90 backdrop-blur-sm border border-edge px-3 py-2 text-xs font-semibold text-text-secondary shadow-lg">
              🗺️ {filteredGeo.length} live markers
            </span>
          </div>
        </div>

        {/* ── Side Panel ──────────────────────── */}
        <div className="w-80 shrink-0 border-l border-edge flex flex-col bg-bg-raised/50">
          {/* Search */}
          <div className="border-b border-edge px-4 py-3">
            <div className="flex items-center gap-2 rounded-lg border border-edge bg-bg-base px-3 py-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                value={sideSearch}
                onChange={e => setSideSearch(e.target.value)}
                placeholder="Filter datasets…"
                className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted outline-none"
              />
              {sideSearch && (
                <button onClick={() => setSideSearch('')} className="text-text-muted hover:text-text-primary text-xs">✕</button>
              )}
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-edge-subtle px-4 py-2.5">
            <span className="text-xs font-semibold text-text-secondary">Datasets</span>
            <span className="rounded-full bg-bg-hover px-2 py-0.5 text-[10px] font-mono text-text-muted">{sidebarDatasets.length}</span>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {sidebarDatasets.map(ds => {
              const cat = CAT[ds.category] || { label: ds.category, accent: '#a78bfa', icon: '•' }
              const snap = snapCache[ds._id]
              const isSelected = selectedDs === ds._id
              const hasCoords = ds.coords || (() => {
                const loc = ds.location?.toLowerCase().replace(/, india$/i, '').trim()
                return loc && COORDS[loc]
              })()

              return (
                <div
                  key={ds._id}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-edge-subtle cursor-pointer transition-colors text-sm ${
                    isSelected ? 'bg-bg-hover/80' : 'hover:bg-bg-hover/40'
                  }`}
                  onClick={() => {
                    setSelectedDs(ds._id)
                    const loc = ds.location?.toLowerCase().replace(/, india$/i, '').trim()
                    if (loc && COORDS[loc]) {
                      setFlyTarget([COORDS[loc].lat, COORDS[loc].lon])
                    }
                  }}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: cat.accent, boxShadow: isSelected ? `0 0 6px ${cat.accent}60` : 'none' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-semibold text-text-primary">{ds.name}</p>
                    <p className="text-[10px] text-text-muted flex items-center gap-1">
                      {hasCoords && <span title="Has map marker">📍</span>}
                      {ds.location || 'Global'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs text-text-secondary">
                      {snap ? formatValue(snap.value, ds.unit) : '—'}
                    </p>
                    {snap?.pct != null && (
                      <p className={`font-mono text-[10px] font-bold ${snap.pct >= 0 ? 'text-emerald' : 'text-rose'}`}>
                        {snap.pct >= 0 ? '+' : ''}{snap.pct.toFixed(2)}%
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Selected Dataset Detail Bar ───────── */}
      <AnimatePresence>
        {selectedDs && (() => {
          const ds = datasets.find(d => d._id === selectedDs)
          if (!ds) return null
          const cat = CAT[ds.category] || { label: ds.category, accent: '#a78bfa' }
          const snap = snapCache[ds._id]
          return (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-t border-edge shrink-0"
            >
              <div className="flex items-center justify-between px-8 py-3.5" style={{ background: `${cat.accent}08` }}>
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ background: cat.accent, boxShadow: `0 0 10px ${cat.accent}40` }} />
                  <div>
                    <p className="text-sm font-bold">{ds.name}</p>
                    <p className="text-[11px] text-text-muted">{ds.source_api} • {ds.location || 'Global'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-text-muted font-semibold tracking-wider">Current</p>
                    <p className="font-mono text-lg font-bold" style={{ color: cat.accent }}>
                      {snap ? formatValue(snap.value, ds.unit) : '—'}
                    </p>
                  </div>
                  {snap?.pct != null && (
                    <div className="text-right">
                      <p className="text-[10px] uppercase text-text-muted font-semibold tracking-wider">Change</p>
                      <p className={`font-mono text-lg font-bold ${snap.pct >= 0 ? 'text-emerald' : 'text-rose'}`}>
                        {snap.pct >= 0 ? '+' : ''}{snap.pct.toFixed(2)}%
                      </p>
                    </div>
                  )}
                  {snap?.ts && (
                    <div className="text-right">
                      <p className="text-[10px] uppercase text-text-muted font-semibold tracking-wider">Updated</p>
                      <p className="text-sm font-semibold text-text-secondary">{timeAgo(snap.ts)}</p>
                    </div>
                  )}
                  <Link
                    to={`/dataset/${ds._id}`}
                    className="rounded-lg border border-edge bg-bg-raised px-4 py-2 text-xs font-semibold transition-all hover:border-bg-hover"
                    style={{ color: cat.accent }}
                  >
                    View Details →
                  </Link>
                  <button
                    onClick={() => setSelectedDs(null)}
                    className="rounded-lg border border-edge bg-bg-raised px-2.5 py-2 text-xs text-text-muted transition-colors hover:border-bg-hover hover:text-text-primary"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </motion.div>
  )
}

export default MapPage
