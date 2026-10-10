import { useEffect, useState } from 'react'

// Rest timer bar: counts down after you tick a set, vibrates when time's up.
export default function RestTimer({ endAt, total, onAdd, onStop }) {
  const [now, setNow] = useState(() => Date.now())
  const left = Math.max(0, Math.round((endAt - now) / 1000))

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (left === 0) navigator.vibrate?.([200, 100, 200])
  }, [left])

  const pct = total ? Math.min(100, ((total - left) / total) * 100) : 100
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0')
  return (
    <div className={`rest-bar ${left === 0 ? 'done' : ''}`} role="timer" aria-live="polite">
      <i style={{ width: `${pct}%` }} />
      <span className="grow">{left === 0 ? 'Rest done. Next set 💪' : `Rest ${mm}:${ss}`}</span>
      {left > 0 && <button className="btn-ghost" onClick={() => onAdd(15)}>+15s</button>}
      <button className="btn-ghost" onClick={onStop}>{left === 0 ? 'OK' : 'Skip'}</button>
    </div>
  )
}
