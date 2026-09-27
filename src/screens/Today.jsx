import { useState } from 'react'
import { useCheckins } from '../hooks'
import { checkIn, isValidCheckin, joinDay } from '../lib/group'
import { todayInTz, prettyDay } from '../lib/dates'
import Avatar from '../components/Avatar'

export default function Today({ user, group, members }) {
  const today = todayInTz(group.timezone)
  const checkins = useCheckins(group.id, today, today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [justDone, setJustDone] = useState(false)

  const done = new Set((checkins || []).filter((c) => isValidCheckin(c, group.timezone)).map((c) => c.uid))
  const active = members.filter((m) => joinDay(m, group.timezone) <= today)
  const meDone = done.has(user.uid)
  const missing = active.filter((m) => !done.has(m.uid))
  const pot = missing.length * group.penalty
  const perHead = done.size ? pot / done.size : 0

  async function onCheckIn() {
    setBusy(true); setError('')
    try {
      await checkIn(user, group)
      setJustDone(true)
      navigator.vibrate?.(60)
    } catch (e) {
      setError(e.message || String(e))
    } finally { setBusy(false) }
  }

  return (
    <section>
      <p className="muted">{prettyDay(today)}</p>
      <h2>{meDone ? 'Done for today 💪' : `Hey ${user.displayName?.split(' ')[0] || 'there'}`}</h2>

      <div className="card today-card">
        <button
          className={`checkin-btn ${meDone ? 'done' : ''} ${justDone ? 'pop' : ''}`}
          onClick={onCheckIn}
          disabled={busy || meDone || checkins === undefined}
        >
          {meDone ? '✓' : busy ? '…' : 'CHECK IN'}
        </button>
        <p className="muted small">
          {meDone ? 'Checked in. See you tomorrow.' : 'Tap after your workout. Closes at midnight.'}
        </p>
        {error && <p className="error small">{error}</p>}
      </div>

      <div className="stats-row">
        <div className="card stat">
          <p className="muted small">At stake now</p>
          <p className="stat-num orange">${pot.toFixed(0)}</p>
          <p className="muted small">{missing.length} not in yet × ${group.penalty}</p>
        </div>
        <div className="card stat">
          <p className="muted small">If it ended now</p>
          <p className="stat-num lime">${perHead.toFixed(2)}</p>
          <p className="muted small">each for {done.size} who showed</p>
        </div>
      </div>

      <h3 className="section-title">Crew today · {done.size}/{active.length}</h3>
      <ul className="member-list">
        {active.map((m) => (
          <li key={m.uid} className={done.has(m.uid) ? 'in' : 'out'}>
            <Avatar member={m} />
            <span className="grow">{m.name}{m.uid === user.uid ? ' (you)' : ''}</span>
            <span className="pill">{done.has(m.uid) ? 'In ✓' : 'Not yet'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
