import { useState } from 'react'
import { setRestVote, photoRequiredFor } from '../lib/group'
import { checkInEverywhere, undoEverywhere } from '../lib/everywhere'
import { prettyDay, addDays, mondayOf } from '../lib/dates'
import { localTime, tzLabel } from '../lib/clock'
import { fmt } from '../lib/money'
import { penaltyOn, targetOn, isRestDay } from '../lib/ledger'
import { useLedgerInputs, runLedger } from '../lib/useLedger'
import { useDayDocs } from '../hooks'
import { photosEnabled } from '../lib/photos'
import Avatar from '../components/Avatar'
import CameraCapture from '../components/CameraCapture'
import { useOnline } from '../lib/device'

export default function Today({ user, group, members, groupIds, meta }) {
  const { clock, money } = group
  const today = clock.today() // YOUR day, in your own timezone
  const myTz = clock.myTz()
  const monthStart = today.slice(0, 8) + '01'
  const inputs = useLedgerInputs(group, monthStart, clock.latestDay())
  const todaysPhotos = useDayDocs(group.id, 'photos', today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [justDone, setJustDone] = useState(false)
  const [camera, setCamera] = useState(null) // null | 'checkin' | 'photo'
  const [note, setNote] = useState('')
  // Check-ins are stamped with Google's clock, so they need a connection.
  const online = useOnline()

  if (!inputs || !todaysPhotos) return <section><p className="muted">Loading...</p></section>

  const photoRequired = photoRequiredFor(group)
  const blocked = photoRequired && !photosEnabled // photos required but Drive not set up
  // One check-in counts in every group you're in. If ANY of them needs a photo, CHECK IN opens the camera.
  const myGroups = groupIds.filter((id) => meta[id])
  const anyNeedsPhoto = photosEnabled && myGroups.some((id) => photoRequiredFor(meta[id]))
  const iLeft = clock.hasLeft(user.uid)
  const report = (r) => setNote(r?.skipped?.length ? `Not checked in: ${r.skipped.map((x) => `${x.name} (${x.reason})`).join(', ')}` : r?.done?.length > 1 ? `Checked in to ${r.done.join(', ')}` : '')
  const done = inputs.doneByDay[today] || new Set()
  const active = members.filter((m) => clock.joinDay(m) <= today && (!clock.leftDay(m) || today < clock.leftDay(m)))
  const activeUids = active.map((m) => m.uid)
  const meDone = done.has(user.uid)
  const myPhoto = todaysPhotos.some((p) => p.uid === user.uid)

  const cur = money.currencyOn(today)
  const curTomorrow = money.currencyOn(addDays(today, 1))
  const $ = (x, opts) => fmt(x, cur, opts)
  const penalty = penaltyOn(today, group.penalty, inputs.penaltyChanges)
  const tomorrowPenalty = penaltyOn(addDays(today, 1), group.penalty, inputs.penaltyChanges)
  const tzPending = clock.pendingFor(user.uid)
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

  // Settled through the last day that has ended for EVERYONE in the group.
  const settledTo = clock.closedThrough()
  const myBalance = settledTo >= monthStart
    ? runLedger(group, members, inputs, monthStart, settledTo).totals[user.uid] || 0
    : 0

  // Where each friend is in THEIR day, relative to yours.
  const stateOf = (uid) => (done.has(uid) ? 'in' : clock.stateFor(uid, today))
  const PILL = { in: 'In', open: 'Not yet', closed: 'Missed', later: 'Not started' }

  async function act(fn) {
    setBusy(true); setError('')
    try { await fn() } catch (e) { setError(e.message || String(e)) } finally { setBusy(false) }
  }

  function onCheckIn() {
    if (photoRequired || anyNeedsPhoto) return setCamera('checkin')
    act(async () => {
      const r = await checkInEverywhere(user, groupIds)
      report(r); setJustDone(true); navigator.vibrate?.(60)
    })
  }

  function onUndo() {
    if (!confirm('Undo today\'s check-in in all your groups?' + (myPhoto ? ' Your photo will be removed from the walls.' : ''))) return
    act(async () => { await undoEverywhere(user, groupIds); setJustDone(false); setNote('') })
  }

  return (
    <section>
      <p className="muted">{prettyDay(today)}</p>
      <h2>{meDone ? 'Done for today' : `Hey ${user.displayName?.split(' ')[0] || 'there'}`}</h2>

      <div className="card today-card">
        {rest && <span className="badge">Rest day{weekly ? ', weekly target −1' : ', nobody pays today'}</span>}
        <button
          className={`checkin-btn ${meDone ? 'done' : ''} ${justDone ? 'pop' : ''}`}
          onClick={onCheckIn}
          disabled={busy || meDone || blocked || iLeft || !online}
        >
          {meDone ? '✓' : busy ? '...' : photoRequired || anyNeedsPhoto ? 'CHECK IN' : 'CHECK IN'}
        </button>
        <p className="muted small">
          {iLeft ? 'You left this group. Check-ins here are closed.'
            : !online && !meDone ? 'You\'re offline. Check-ins need a connection, because they\'re stamped with Google\'s clock.'
            : meDone ? 'Checked in. See you tomorrow.'
            : blocked ? 'This group requires a workout photo, but photos aren\'t set up yet. Turn the photo rule off in the Group tab, or deploy the Drive script (guide, Phase 4).'
            : photoRequired ? 'Opens the camera. Your photo is your check-in. Closes at your midnight.'
            : 'Tap after your workout. Closes at your midnight.'}
        </p>
        {meDone && !myPhoto && photosEnabled && !photoRequired && (
          <button className="btn-ghost" onClick={() => setCamera('photo')}>Add workout photo</button>
        )}
        {meDone && myPhoto && <p className="muted small">Photo posted to the wall</p>}
        {meDone && <button className="link-btn" onClick={onUndo} disabled={busy}>Undo check-in</button>}
        {myGroups.length > 1 && !meDone && !iLeft && <p className="muted small">One check-in counts in all {myGroups.length} of your groups.</p>}
        {note && <p className="muted small">{note}</p>}
        {error && <p className="error small">{error}</p>}
      </div>
      {camera && (
        <CameraCapture
          user={user} group={group} groupIds={groupIds} checkIn={camera === 'checkin'}
          onUploaded={(r) => { report(r); if (camera === 'checkin') { setJustDone(true); navigator.vibrate?.(60) } }}
          onClose={() => setCamera(null)}
        />
      )}

      {weekly ? (
        <div className="stats-row">
          <div className="card stat">
            <p className="muted small">Your week</p>
            <p className={`stat-num ${weekCount(user.uid) >= weekNeeded ? 'lime' : ''}`}>{weekCount(user.uid)}/{weekNeeded}</p>
            <p className="muted small">{Math.max(0, weekNeeded - weekCount(user.uid)) || 'target hit'}{weekCount(user.uid) < weekNeeded ? ' to go' : ''}</p>
          </div>
          <div className="card stat">
            <p className="muted small">Days left</p>
            <p className="stat-num">{daysLeft}</p>
            <p className="muted small">settles Sun midnight</p>
          </div>
          <div className="card stat">
            <p className="muted small">Your month</p>
            <p className={`stat-num ${myBalance >= 0 ? 'lime' : 'orange'}`}>{$(myBalance)}</p>
            <p className="muted small">settled so far</p>
          </div>
        </div>
      ) : (
        <div className="stats-row">
          <div className="card stat">
            <p className="muted small">At stake now</p>
            <p className="stat-num orange">{$(pot, { digits: 0 })}</p>
            <p className="muted small">{rest ? 'rest day' : `${missing.length} not in × ${$(penalty, { digits: 0 })}`}</p>
          </div>
          <div className="card stat">
            <p className="muted small">If it ended now</p>
            <p className="stat-num lime">{$(perHead)}</p>
            <p className="muted small">each for {done.size} who showed</p>
          </div>
          <div className="card stat">
            <p className="muted small">Your month</p>
            <p className={`stat-num ${myBalance >= 0 ? 'lime' : 'orange'}`}>{$(myBalance)}</p>
            <p className="muted small">settled so far</p>
          </div>
        </div>
      )}

      <div className="card rest-card">
        <div className="grow-col">
          <strong>Rest day?</strong>
          <p className="muted small">{voteCount}/{activeUids.length} voted · {needed} needed, each before their own midnight</p>
        </div>
        <button className={iVoted ? 'btn-primary' : 'btn-ghost'} disabled={busy} onClick={() => act(() => setRestVote(user, group, !iVoted))}>
          {iVoted ? 'Voted' : 'Vote rest'}
        </button>
      </div>
      <p className="muted small">
        Rule: {weekly ? `${target} workout days a week, ${$(penalty, { digits: 0 })} per day short` : `work out every day, ${$(penalty, { digits: 0 })} per miss`}
        {tomorrowPenalty !== penalty || curTomorrow !== cur ? ` · ${fmt(tomorrowPenalty, curTomorrow, { digits: 0 })} from tomorrow` : ''}
        {' '}· your day runs on {tzLabel(myTz)}
        {tzPending.length > 0 && ` · switching to ${tzLabel(tzPending[tzPending.length - 1].timezone)} from tomorrow (your phone's timezone changed)`}
      </p>

      <h3 className="section-title">Crew {weekly ? 'this week' : 'today'} · {done.size}/{active.length} in for {prettyDay(today).split(',')[0]}</h3>
      <ul className="member-list">
        {active.map((m) => {
          const theirTz = clock.tzAt(m.uid)
          return (
            <li key={m.uid} className={stateOf(m.uid) === 'in' ? 'in' : stateOf(m.uid) === 'later' ? '' : 'out'}>
              <Avatar member={m} />
              <span className="grow">
                {m.name}{m.uid === user.uid ? ' (you)' : ''}{votes[m.uid] ? <span className="muted small"> (voted rest)</span> : ''}
                {theirTz !== myTz && <span className="muted small"> · {localTime(theirTz)} there</span>}
              </span>
              {weekly && <span className="muted small">{weekCount(m.uid)}/{weekNeeded}</span>}
              <span className="pill">{PILL[stateOf(m.uid)]}</span>
            </li>
          )
        })}
      </ul>
      <p className="muted small">Everyone's day follows their own phone's timezone. A day settles once it has ended for everyone.</p>
    </section>
  )
}
