import { useState } from 'react'
import { checkIn, setRestVote, joinDay, undoCheckIn, photoRequiredFor } from '../lib/group'
import { todayInTz, prettyDay, addDays, mondayOf } from '../lib/dates'
import { penaltyOn, targetOn, isRestDay } from '../lib/ledger'
import { useLedgerInputs, runLedger } from '../lib/useLedger'
import { useDayDocs } from '../hooks'
import { photosEnabled } from '../lib/photos'
import Avatar from '../components/Avatar'
import CameraCapture from '../components/CameraCapture'

const money = (x) => `${x < 0 ? '−' : ''}$${Math.abs(x).toFixed(2)}`

export default function Today({ user, group, members }) {
  const tz = group.timezone
  const today = todayInTz(tz)
  const monthStart = today.slice(0, 8) + '01'
  const inputs = useLedgerInputs(group, monthStart, today)
  const todaysPhotos = useDayDocs(group.id, 'photos', today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [justDone, setJustDone] = useState(false)
  const [camera, setCamera] = useState(null) // null | 'checkin' | 'photo'

  if (!inputs || !todaysPhotos) return <section><p className="muted">Loading…</p></section>

  const photoRequired = photoRequiredFor(group)
  const blocked = photoRequired && !photosEnabled // photos required but Drive not set up
  const done = inputs.doneByDay[today] || new Set()
  const active = members.filter((m) => joinDay(m, tz) <= today)
  const activeUids = active.map((m) => m.uid)
  const meDone = done.has(user.uid)
  const myPhoto = todaysPhotos.some((p) => p.uid === user.uid)

  const penalty = penaltyOn(today, group.penalty, inputs.penaltyChanges)
  const tomorrowPenalty = penaltyOn(addDays(today, 1), group.penalty, inputs.penaltyChanges)
  const target = targetOn(today, group.weeklyTarget, inputs.targetChanges)
  const weekly = target < 7

  const votes = inputs.restVotes[today] || {}
  const rest = isRestDay(today, votes, activeUids)
  const voteCount = activeUids.filter((u) => votes[u]).length
  const iVoted = Boolean(votes[user.uid])
  const needed = Math.floor(activeUids.length / 2) + 1

  // This week's progress (weekly mode)
  const mon = mondayOf(today)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
  const weekCount = (uid) => weekDays.filter((d) => d <= today && inputs.doneByDay[d]?.has(uid)).length
  const weekRest = weekDays.filter((d) => d <= today && isRestDay(d, inputs.restVotes[d], activeUids)).length
  const weekNeeded = Math.max(0, target - weekRest)
  const daysLeft = weekDays.filter((d) => d >= today).length

  // Daily mode "at stake"
  const missing = active.filter((m) => !done.has(m.uid))
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

  function onCheckIn() {
    if (photoRequired) return setCamera('checkin')
    act(async () => { await checkIn(user, group); setJustDone(true); navigator.vibrate?.(60) })
  }

  function onUndo() {
    if (!confirm('Undo today\'s check-in?' + (myPhoto ? ' Your photo will be removed from the wall.' : ''))) return
    act(async () => { await undoCheckIn(user, group, { hasPhoto: myPhoto }); setJustDone(false) })
  }

  return (
    <section>
      <p className="muted">{prettyDay(today)}</p>
      <h2>{meDone ? 'Done for today 💪' : `Hey ${user.displayName?.split(' ')[0] || 'there'}`}</h2>

      <div className="card today-card">
        {rest && <span className="badge">😴 Rest day{weekly ? ', weekly target −1' : ', nobody pays today'}</span>}
        <button
          className={`checkin-btn ${meDone ? 'done' : ''} ${justDone ? 'pop' : ''}`}
          onClick={onCheckIn}
          disabled={busy || meDone || blocked}
        >
          {meDone ? '✓' : busy ? '…' : photoRequired ? '📸 CHECK IN' : 'CHECK IN'}
        </button>
        <p className="muted small">
          {meDone ? 'Checked in. See you tomorrow.'
            : blocked ? 'This group requires a workout photo, but photos aren\'t set up yet. Turn the photo rule off in the Group tab, or deploy the Drive script (guide, Phase 4).'
            : photoRequired ? 'Opens the camera. Your photo is your check-in. Closes at midnight.'
            : 'Tap after your workout. Closes at midnight.'}
        </p>
        {meDone && !myPhoto && photosEnabled && !photoRequired && (
          <button className="btn-ghost" onClick={() => setCamera('photo')}>📸 Add workout photo</button>
        )}
        {meDone && myPhoto && <p className="muted small">📸 Photo posted to the wall</p>}
        {meDone && <button className="link-btn" onClick={onUndo} disabled={busy}>Undo check-in</button>}
        {error && <p className="error small">{error}</p>}
      </div>
      {camera && (
        <CameraCapture
          user={user} group={group} checkIn={camera === 'checkin'}
          onUploaded={() => { if (camera === 'checkin') { setJustDone(true); navigator.vibrate?.(60) } }}
          onClose={() => setCamera(null)}
        />
      )}

      {weekly ? (
        <div className="stats-row">
          <div className="card stat">
            <p className="muted small">Your week</p>
            <p className={`stat-num ${weekCount(user.uid) >= weekNeeded ? 'lime' : ''}`}>{weekCount(user.uid)}/{weekNeeded}</p>
            <p className="muted small">{Math.max(0, weekNeeded - weekCount(user.uid)) || 'target hit ✓'}{weekCount(user.uid) < weekNeeded ? ' to go' : ''}</p>
          </div>
          <div className="card stat">
            <p className="muted small">Days left</p>
            <p className="stat-num">{daysLeft}</p>
            <p className="muted small">settles Sun midnight</p>
          </div>
          <div className="card stat">
            <p className="muted small">Your month</p>
            <p className={`stat-num ${myBalance >= 0 ? 'lime' : 'orange'}`}>{money(myBalance)}</p>
            <p className="muted small">settled so far</p>
          </div>
        </div>
      ) : (
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
      )}

      <div className="card rest-card">
        <div className="grow-col">
          <strong>Rest day?</strong>
          <p className="muted small">{voteCount}/{activeUids.length} voted · {needed} needed before midnight</p>
        </div>
        <button className={iVoted ? 'btn-primary' : 'btn-ghost'} disabled={busy} onClick={() => act(() => setRestVote(user, group, !iVoted))}>
          {iVoted ? 'Voted ✓' : 'Vote rest'}
        </button>
      </div>
      <p className="muted small">
        Rule: {weekly ? `${target} workout days a week, $${penalty} per day short` : `work out every day, $${penalty} per miss`}
        {tomorrowPenalty !== penalty ? ` · $${tomorrowPenalty} from tomorrow` : ''}
      </p>

      <h3 className="section-title">Crew {weekly ? 'this week' : 'today'} · {done.size}/{active.length} in today</h3>
      <ul className="member-list">
        {active.map((m) => (
          <li key={m.uid} className={done.has(m.uid) ? 'in' : 'out'}>
            <Avatar member={m} />
            <span className="grow">{m.name}{m.uid === user.uid ? ' (you)' : ''}{votes[m.uid] ? ' 😴' : ''}</span>
            {weekly && <span className="muted small">{weekCount(m.uid)}/{weekNeeded}</span>}
            <span className="pill">{done.has(m.uid) ? 'In ✓' : 'Not yet'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
