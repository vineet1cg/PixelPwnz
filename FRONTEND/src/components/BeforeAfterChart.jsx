import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts'
import { api } from '../lib/api.js'

function formatTime(iso) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function MiniTip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-edge bg-bg-raised px-2 py-1 text-[10px] shadow-lg">
      <p className="font-mono font-bold text-text-primary">{Number(payload[0].value).toLocaleString()}</p>
      <p className="text-text-muted mt-0.5">{payload[0].payload.time}</p>
    </div>
  )
}

export default function BeforeAfterChart({ datasetId, eventTime, color = '#f59e0b' }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const snaps = await api.getSnapshots(datasetId)
        // Find closest index
        const t = new Date(eventTime).getTime()
        let closestIdx = 0
        let minDiff = Infinity
        snaps.forEach((s, i) => {
          const diff = Math.abs(new Date(s.timestamp).getTime() - t)
          if (diff < minDiff) {
            minDiff = diff
            closestIdx = i
          }
        })

        const start = Math.max(0, closestIdx - 5)
        const end = Math.min(snaps.length, closestIdx + 6)
        
        const slice = snaps.slice(start, end).map((s, idx) => {
          const isTarget = i => (start + i) === closestIdx;
          return {
            time: formatTime(s.timestamp),
            value: s.value,
            isEvent: isTarget(idx)
          }
        })
        setData(slice)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (datasetId && eventTime) load()
  }, [datasetId, eventTime])

  if (loading) return <div className="h-24 flex items-center justify-center text-xs text-text-muted">Loading chart…</div>
  if (!data?.length) return <div className="h-24 flex items-center justify-center text-xs text-text-muted">No context data available</div>

  let eventPoint = data.find(d => d.isEvent)
  // Fallback to exactly data point if the timestamp is unmatched completely but index matches
  if (!eventPoint) eventPoint = data[Math.floor(data.length / 2)]

  return (
    <div className="relative h-28 w-full mt-2 group">
      <Link 
        to={`/datasets/${datasetId}`} 
        className="absolute top-0 right-2 z-10 rounded-md border border-edge bg-bg-raised/80 px-2 py-1 text-[10px] font-bold text-text-muted opacity-0 backdrop-blur transition-opacity hover:border-bg-hover hover:text-text-primary group-hover:opacity-100"
      >
        View Dataset →
      </Link>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${datasetId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" hide />
          <Tooltip content={<MiniTip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={2}
            fill={`url(#grad-${datasetId})`} 
            isAnimationActive={false}
          />
          {eventPoint && (
            <ReferenceDot x={eventPoint.time} y={eventPoint.value} r={4} fill={color} stroke="#18181b" strokeWidth={2} isFront={true} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
