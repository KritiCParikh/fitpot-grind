import { useState } from 'react'
import { useMyDays, boostLabel } from '../lib/myDays'
import { myToday } from '../lib/clock'
import { monthDays, weekdayOf, currentStreak } from '../lib/dates'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// My locker → My calendar: your own workout calendar. A day counts if you
// logged a workout in Training or checked in to any of your groups (past and
// present), so it works the same whether you're in a crew, several, or none.
// Extra sessions that day show as a +1 / +2 boost (phase 5.13). Private to you.
export default function MyCalendar({ user }) {
  const today = myToday()
  const { days: sessions } = useMyDays(user)
  const [ym, setYm] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 }))

  const worked = new Set(sessions.keys())

  const days = monthDays(ym.y, ym.m)
  const inMonth = days.filter((d) => worked.has(d)).length
  const boosts = days.reduce((n, d) => n + Math.max(0, (sessions.get(d) || 0) - 1), 0)
  const isCurrentMonth = days.includes(today)
  const monthLabel = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const shift = (n) => setYm(({ y, m }) => { const d = new Date(Date.UTC(y, m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() } })

  return (
    <>
      <div className="stats-row">
        <div className="card stat">
          <p className="muted small">This month</p>
          <p className="stat-num lime">{inMonth}{boosts > 0 && <span className="boost-sm"> +{boosts}</span>}</p>
        </div>
        <div className="card stat">
          <p className="muted small">Streak</p>
          <p className="stat-num">{currentStreak(worked, today)}</p>
        </div>
        <div className="card stat">
          <p className="muted small">Total</p>
          <p className="stat-num">{worked.size}</p>
        </div>
      </div>
      <div className="card my-cal">
        <div className="cal-head">
          <button type="button" className="btn-ghost" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <strong>{monthLabel}</strong>
          <button type="button" className="btn-ghost" onClick={() => shift(1)} disabled={isCurrentMonth} aria-label="Next month">›</button>
        </div>
        <div className="cal-grid">
          {WEEKDAYS.map((w, i) => <span key={i} className="cal-wd">{w}</span>)}
          {Array.from({ length: weekdayOf(days[0]) }, (_, i) => <span key={'b' + i} />)}
          {days.map((d) => (
            <span key={d} className={`cal-day ${worked.has(d) ? 'done' : ''} ${d === today ? 'today' : ''}`}
              aria-label={`${d}${worked.has(d) ? ', worked out' : ''}${sessions.get(d) > 1 ? `, ${sessions.get(d)} sessions` : ''}`}>
              {+d.slice(8)}
              {boostLabel(sessions.get(d)) && <i className="boost" aria-hidden="true">{boostLabel(sessions.get(d))}</i>}
            </span>
          ))}
        </div>
        <div className="legend">
          <span><i className="dot done" />Worked out</span>
          <span><i className="dot today-dot" />Today</span>
          <span><i className="boost legend-boost">+1</i>Extra session</span>
        </div>
        <p className="muted small">Every day you check in to a crew (past days too) or log a workout in Training, in any group or none. A second or third session that day is a boost.</p>
      </div>
    </>
  )
}
