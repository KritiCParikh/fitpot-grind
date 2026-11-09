import { useState } from 'react'
import { useUserDoc, useMyCheckinsEverywhere } from '../hooks'
import { useWorkouts } from '../lib/privateData'
import { myToday } from '../lib/clock'
import { monthDays, weekdayOf, currentStreak } from '../lib/dates'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Me → Progress: your own workout calendar. A day counts if you logged a
// workout in Training or checked in to any of your groups, so it works the
// same whether you're in a crew, several, or none. Private to you.
export default function MyCalendar({ user }) {
  const today = myToday()
  const profile = useUserDoc(user.uid)
  const workouts = useWorkouts(user.uid)
  const checkins = useMyCheckinsEverywhere(profile?.groupIds, user.uid)
  const [ym, setYm] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 }))

  const worked = new Set([
    ...(workouts || []).map((w) => w.date),
    ...checkins.map((c) => c.date),
  ].filter(Boolean))

  const days = monthDays(ym.y, ym.m)
  const inMonth = days.filter((d) => worked.has(d)).length
  const isCurrentMonth = days.includes(today)
  const monthLabel = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const shift = (n) => setYm(({ y, m }) => { const d = new Date(Date.UTC(y, m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() } })

  return (
    <>
      <div className="stats-row">
        <div className="card stat">
          <p className="muted small">This month</p>
          <p className="stat-num lime">{inMonth}</p>
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
              aria-label={`${d}${worked.has(d) ? ', worked out' : ''}`}>
              {+d.slice(8)}
            </span>
          ))}
        </div>
        <div className="legend">
          <span><i className="dot done" />Worked out</span>
          <span><i className="dot today-dot" />Today</span>
        </div>
        <p className="muted small">Every day you log a workout or check in, in any group or none.</p>
      </div>
    </>
  )
}
