import { useMemo, useRef, useState } from 'react'

// Single-series weight trend: 2px line, recessive grid, one y-axis,
// crosshair + tooltip on hover/touch. Values arrive in the display unit.
export default function WeightChart({ points, unit, goal }) {
  const [hover, setHover] = useState(null)
  const ref = useRef(null)
  const W = 340, H = 180, L = 36, R = 10, T = 12, B = 22

  const geo = useMemo(() => {
    if (points.length < 2) return null
    const toT = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
    const xs = points.map((p) => toT(p.date))
    const vals = points.map((p) => p.value).concat(goal ? [goal] : [])
    let lo = Math.min(...vals), hi = Math.max(...vals)
    const pad = Math.max(0.5, (hi - lo) * 0.15)
    lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad)
    const x = (t) => L + ((t - xs[0]) / Math.max(1, xs[xs.length - 1] - xs[0])) * (W - L - R)
    const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
    const ticks = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v * 10) / 10)
    return { xs, x, y, ticks, lo, hi }
  }, [points, goal])

  if (!geo) return <p className="muted small">Log at least two days to see your trend.</p>
  const { xs, x, y, ticks } = geo
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(xs[i]).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const short = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

  function onMove(e) {
    const box = ref.current.getBoundingClientRect()
    const cx = ((e.touches?.[0]?.clientX ?? e.clientX) - box.left) * (W / box.width)
    let best = 0
    for (let i = 1; i < xs.length; i++) if (Math.abs(x(xs[i]) - cx) < Math.abs(x(xs[best]) - cx)) best = i
    setHover(best)
  }

  const hp = hover != null ? points[hover] : null
  return (
    <div className="chart-wrap">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="chart" role="img"
        aria-label={`Weight trend from ${points[0].value} to ${points[points.length - 1].value} ${unit}`}
        onMouseMove={onMove} onTouchStart={onMove} onTouchMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
          </g>
        ))}
        <text x={L} y={H - 4} className="axis">{short(points[0].date)}</text>
        <text x={W - R} y={H - 4} textAnchor="end" className="axis">{short(points[points.length - 1].date)}</text>
        {goal ? (
          <g>
            <line x1={L} x2={W - R} y1={y(goal)} y2={y(goal)} className="goal" />
            <text x={W - R} y={y(goal) - 4} textAnchor="end" className="axis">goal {goal}</text>
          </g>
        ) : null}
        <path d={path} className="line" />
        {hp && (
          <g>
            <line x1={x(xs[hover])} x2={x(xs[hover])} y1={T} y2={H - B} className="crosshair" />
            <circle cx={x(xs[hover])} cy={y(hp.value)} r="5" className="dot" />
          </g>
        )}
        {!hp && <circle cx={x(xs[xs.length - 1])} cy={y(points[points.length - 1].value)} r="4" className="dot" />}
      </svg>
      {hp && (
        <div className="tooltip" style={{ left: `${(x(xs[hover]) / W) * 100}%` }}>
          <strong>{hp.value} {unit}</strong><span>{short(hp.date)}</span>
        </div>
      )}
    </div>
  )
}
