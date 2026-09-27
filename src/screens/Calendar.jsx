import { useState } from 'react'
import { useMyCheckins } from '../hooks'
import { isValidCheckin, joinDay } from '../lib/group'
import { todayInTz, monthDays, weekdayOf, prettyDay, currentStreak, bestStreak } from '../lib/dates'
import { useLedgerInputs, runLedger } from '../lib/useLedger'
import Avatar from '../components/Avatar'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Calendar({ user, group, members }) {
  const tz = group.timezone
  const today = todayInTz(tz)
  const [ym, setYm] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 }))
  const [selected, setSelected] = useState(null)

  const days = monthDays(ym.y, ym.m)
  const lastDay = days[days.length - 1] < today ? days[days.length - 1] : today
  const inputs = useLedgerInputs(group, days[0], lastDay)
  const mine = useMyCheckins(group.id, user.uid)

  const myDays = new Set((mine || []).filter((c) => isValidCheckin(c, tz)).map((c) => c.date))
  const ledger = inputs && days[0] <= today ? runLedger(group, members, inputs, days[0], lastDay) : { days: [] }
  const ledgerByDay = Object.fromEntries(ledger.days.map((d) => [d.day, d]))

  const me = members.find((m) => m.uid === user.uid)
  const myJoin = me ? joinDay(me, tz) : today

  function statusOf(day) {
    if (day > today || day < myJoin) return 'none'
    if (myDays.has(day)) return 'done'
    if (ledgerByDay[day]?.rest) return 'rest'
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
          <span><i className="dot rest" />Rest</span>
          <span><i className="dot pending" />Today</span>
        </div>
      </div>

      {selected && ledgerByDay[selected] && (
        <DayDetail info={ledgerByDay[selected]} open={selected === today} members={members} />
      )}
    </section>
  )
}

function DayDetail({ info, open, members }) {
  const byUid = Object.fromEntries(members.map((m) => [m.uid, m]))
  const showed = new Set(info.showed)
  const everyone = [...info.showed, ...info.missed].map((u) => byUid[u]).filter(Boolean)
  // Today is still open: show what's at stake, not a settled result.
  const pot = info.rest ? 0 : info.missed.length * info.penalty
  const each = info.showed.length && !info.rest ? pot / info.showed.length : 0

  return (
    <div className="card day-detail">
      <p className="muted small">{prettyDay(info.day)}{open ? ' · still open' : ''} · ${info.penalty} penalty</p>
      {info.rest ? (
        <p>😴 <strong>Rest day</strong>, nobody paid.</p>
      ) : (
        <p>
          Pot <strong className="orange">${pot}</strong>
          {info.showed.length
            ? <> · <strong className="lime">${each.toFixed(2)}</strong> each to {info.showed.length}</>
            : ' · nobody showed, nobody pays'}
        </p>
      )}
      <ul className="member-list">
        {everyone.map((m) => (
          <li key={m.uid} className={showed.has(m.uid) ? 'in' : 'out'}>
            <Avatar member={m} size={28} />
            <span className="grow">{m.name}</span>
            <span className="pill">
              {showed.has(m.uid) ? (each ? `+$${each.toFixed(2)}` : 'In ✓')
                : open ? 'Not yet' : info.rest || !info.showed.length ? 'Missed' : `−$${info.penalty}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
