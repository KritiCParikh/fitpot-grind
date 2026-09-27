import { useState } from 'react'
import { checkIn, setRestVote, joinDay } from '../lib/group'
import { todayInTz, prettyDay, addDays } from '../lib/dates'
import { penaltyOn, isRestDay } from '../lib/ledger'
import { useLedgerInputs, runLedger } from '../lib/useLedger'
import Avatar from '../components/Avatar'

const money = (x) => `${x < 0 ? '−' : ''}$${Math.abs(x).toFixed(2)}`

export default function Today({ user, group, members }) {
  const tz = group.timezone
  const today = todayInTz(tz)
  const monthStart = today.slice(0, 8) + '01'
  const inputs = useLedgerInputs(group, monthStart, today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [justDone, setJustDone] = useState(false)

  if (!inputs) return <section><p className="muted">Loading…</p></section>

  const done = inputs.doneByDay[today] || new Set()
  const active = members.filter((m) => joinDay(m, tz) <= today)
  const activeUids = active.map((m) => m.uid)
  const meDone = done.has(user.uid)
  const missing = active.filter((m) => !done.has(m.uid))
  const penalty = penaltyOn(today, group.penalty, inputs.penaltyChanges)
  const tomorrowPenalty = penaltyOn(addDays(today, 1), group.penalty, inputs.penaltyChanges)

  const votes = inputs.restVotes[today] || {}
  const rest = isRestDay(today, votes, activeUids)
  const voteCount = activeUids.filter((u) => votes[u]).length
  const iVoted = Boolean(votes[user.uid])
  const needed = Math.floor(activeUids.length / 2) + 1

  const pot = rest ? 0 : missing.length * penalty
  const perHead = done.size && !rest ? pot / done.size : 0

  const yesterday = addDays(today, -1)
  const myBalance = yesterday >= monthStart
    ? runLedger(group, members, inputs, monthStart, yesterday).totals[user.uid] || 0
    : 0

  async function act(fn) {
    setBusy(true); setError('')
    try { await fn() } catch (e) { setError(e.message || String(e)) } finally { setBusy(false) }
  }

  return (
    <section>
      <p className="muted">{prettyDay(today)}</p>
      <h2>{meDone ? 'Done for today 💪' : `Hey ${user.displayName?.split(' ')[0] || 'there'}`}</h2>

      <div className="card today-card">
        {rest && <span className="badge">😴 Rest day, nobody pays today</span>}
        <button
          className={`checkin-btn ${meDone ? 'done' : ''} ${justDone ? 'pop' : ''}`}
          onClick={() => act(async () => { await checkIn(user, group); setJustDone(true); navigator.vibrate?.(60) })}
          disabled={busy || meDone}
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
          <p className="muted small">{rest ? 'rest day' : `${missing.length} not in × $${penalty}`}</p>
        </div>
        <div className="card stat">
          <p className="muted small">If it ended now</p>
          <p className="stat-num lime">${perHead.toFixed(2)}</p>
          <p className="muted small">each for {done.size} who showed</p>
        </div>
        <div className="card stat">
          <p className="muted small">Your month</p>
          <p className={`stat-num ${myBalance >= 0 ? 'lime' : 'orange'}`}>{money(myBalance)}</p>
          <p className="muted small">through yesterday</p>
        </div>
      </div>

      <div className="card rest-card">
        <div className="grow-col">
          <strong>Rest day?</strong>
          <p className="muted small">{voteCount}/{activeUids.length} voted · {needed} needed before midnight</p>
        </div>
        <button className={iVoted ? 'btn-primary' : 'btn-ghost'} disabled={busy} onClick={() => act(() => setRestVote(user, group, !iVoted))}>
          {iVoted ? 'Voted ✓' : 'Vote rest'}
        </button>
      </div>
      {tomorrowPenalty !== penalty && (
        <p className="muted small">Penalty changes to ${tomorrowPenalty} from tomorrow.</p>
      )}

      <h3 className="section-title">Crew today · {done.size}/{active.length}</h3>
      <ul className="member-list">
        {active.map((m) => (
          <li key={m.uid} className={done.has(m.uid) ? 'in' : 'out'}>
            <Avatar member={m} />
            <span className="grow">{m.name}{m.uid === user.uid ? ' (you)' : ''}{votes[m.uid] ? ' 😴' : ''}</span>
            <span className="pill">{done.has(m.uid) ? 'In ✓' : 'Not yet'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
