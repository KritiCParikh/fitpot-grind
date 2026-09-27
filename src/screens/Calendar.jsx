import { useState } from 'react'
import { useCheckins, useMyCheckins } from '../hooks'
import { isValidCheckin, joinDay } from '../lib/group'
import { todayInTz, monthDays, weekdayOf, prettyDay, currentStreak, bestStreak } from '../lib/dates'
import Avatar from '../components/Avatar'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Calendar({ user, group, members }) {
  const tz = group.timezone
  const today = todayInTz(tz)
  const [ym, setYm] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 }))
  const [selected, setSelected] = useState(null)

  const days = monthDays(ym.y, ym.m)
  const monthCheckins = useCheckins(group.id, days[0], days[days.length - 1])
  const mine = useMyCheckins(group.id, user.uid)

  const valid = (list) => (list || []).filter((c) => isValidCheckin(c, tz))
  const myDays = new Set(valid(mine).map((c) => c.date))
  const byDay = {}
  for (const c of valid(monthCheckins)) (byDay[c.date] ||= new Set()).add(c.uid)

  const me = members.find((m) => m.uid === user.uid)
  const myJoin = me ? joinDay(me, tz) : today

  function statusOf(day) {
    if (day > today || day < myJoin) return 'none'
    if (myDays.has(day)) return 'done'
    return day === today ? 'pending' : 'missed'
  }

  const monthLabel = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const shift = (n) => { setSelected(null); setYm(({ y, m }) => { const d = new Date(Date.UTC(y, m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() } }) }
  const isCurrentMonth = days.includes(today)

  return (
    <section>
      <h2>Calendar</h2>

      <div className="stats-row">
        <div className="card stat">
          <p className="muted small">Current streak</p>
          <p className="stat-num lime">{currentStreak(myDays, today)}🔥</p>
        </div>
        <div className="card stat">
          <p className="muted small">Best streak</p>
          <p className="stat-num">{bestStreak(myDays)}</p>
        </div>
        <div className="card stat">
          <p className="muted small">Total</p>
          <p className="stat-num">{myDays.size}</p>
        </div>
      </div>

      <div className="card">
        <div className="cal-head">
          <button className="btn-ghost" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <strong>{monthLabel}</strong>
          <button className="btn-ghost" onClick={() => shift(1)} disabled={isCurrentMonth} aria-label="Next month">›</button>
        </div>
        <div className="cal-grid">
          {WEEKDAYS.map((w, i) => <span key={i} className="cal-wd">{w}</span>)}
          {Array.from({ length: weekdayOf(days[0]) }, (_, i) => <span key={'b' + i} />)}
          {days.map((d) => (
            <button
              key={d}
              className={`cal-day ${statusOf(d)} ${d === today ? 'today' : ''} ${d === selected ? 'sel' : ''}`}
              onClick={() => setSelected(d === selected ? null : d)}
              disabled={d > today}
            >
              {+d.slice(8)}
            </button>
          ))}
        </div>
        <div className="legend">
          <span><i className="dot done" />Done</span>
          <span><i className="dot missed" />Missed</span>
          <span><i className="dot pending" />Today</span>
        </div>
      </div>

      {selected && <DayDetail day={selected} today={today} group={group} members={members} doneSet={byDay[selected] || new Set()} />}
    </section>
  )
}

function DayDetail({ day, today, group, members, doneSet }) {
  const active = members.filter((m) => joinDay(m, group.timezone) <= day)
  const done = active.filter((m) => doneSet.has(m.uid))
  const missed = active.filter((m) => !doneSet.has(m.uid))
  const pot = missed.length * group.penalty
  const each = done.length ? pot / done.length : 0
  const open = day === today

  return (
    <div className="card day-detail">
      <p className="muted small">{prettyDay(day)}{open ? ' · still open' : ''}</p>
      <p>
        Pot <strong className="orange">${pot}</strong>
        {done.length ? <> · <strong className="lime">${each.toFixed(2)}</strong> each to {done.length}</> : ' · nobody showed, nobody collects'}
      </p>
      <ul className="member-list">
        {active.map((m) => (
          <li key={m.uid} className={doneSet.has(m.uid) ? 'in' : 'out'}>
            <Avatar member={m} size={28} />
            <span className="grow">{m.name}</span>
            <span className="pill">{doneSet.has(m.uid) ? 'In ✓' : open ? 'Not yet' : `Missed −$${group.penalty}`}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
