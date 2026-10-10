import { useState } from 'react'
import {
  setActiveGroup, leaveGroup, changePenalty, changeTarget, setPhotoRequired, photoRequiredFor, changeCurrency, nextDay,
} from '../lib/group'
import { prettyDay, addDays, mondayOf } from '../lib/dates'
import { penaltyOn, targetOn } from '../lib/ledger'
import { useLedgerInputs } from '../lib/useLedger'
import { tzLabel, localTime } from '../lib/clock'
import { CURRENCIES, currencyInfo, fmt, fetchRate, roundPenalty, MAX_PENALTY } from '../lib/money'
import Avatar from '../components/Avatar'
import JoinCreate from '../components/JoinCreate'
import { useGroupCtx } from '../groupContext'

const shortDay = (d) => prettyDay(d).split(', ').slice(1).join(', ')

// Group tab: your groups (switch between them), join or create another, and
// the settings of the group you're looking at.
export default function Group({ user, groupIds, meta, activeId }) {
  const { status, group, members } = useGroupCtx()
  const [adding, setAdding] = useState(false)
  const none = groupIds.length === 0
  return (
    <section>
      <h2>{none ? 'Groups' : 'Your groups'}</h2>
      {none ? (
        <div className="card">
          <p>You're not in a group yet.</p>
          <p className="muted small">Join friends with their 6-character passcode, or start a group and invite them. You can be in several groups; one check-in counts in all of them.</p>
        </div>
      ) : (
        <ul className="member-list">
          {groupIds.map((id) => (
            <li key={id} className={id === activeId ? 'in' : ''}>
              <span className="grow">{meta[id]?.name || '...'}</span>
              {id === activeId
                ? <span className="pill">Viewing</span>
                : <button className="btn-ghost" onClick={() => setActiveGroup(user, id)}>Switch</button>}
            </li>
          ))}
        </ul>
      )}
      {none || adding
        ? <JoinCreate user={user} onDone={() => setAdding(false)} />
        : <button className="btn-ghost" onClick={() => setAdding(true)}>+ Join or create another group</button>}

      {status === 'loading' && <p className="muted">Loading...</p>}
      {status === 'ready' && <GroupSettings user={user} group={group} members={members} groupIds={groupIds} />}
    </section>
  )
}

function GroupSettings({ user, group, members, groupIds }) {
  const { clock, money } = group
  const [copied, setCopied] = useState(false)
  const today = clock.today()
  const inputs = useLedgerInputs(group, today, today)
  const changes = inputs?.penaltyChanges || []
  // "Tomorrow" for group settings = the day after the furthest-ahead member's today.
  const startDay = nextDay(group)
  const current = penaltyOn(today, group.penalty, changes)
  const tomorrow = penaltyOn(startDay, group.penalty, changes)
  const cur = money.currencyOn(today)
  const curNext = money.currencyOn(startDay)
  const [penalty, setPenalty] = useState('')
  const [saving, setSaving] = useState(false)
  const nextMonday = addDays(mondayOf(clock.latestDay()), 7)
  const tChanges = inputs?.targetChanges || []
  const target = targetOn(today, group.weeklyTarget, tChanges)
  const nextTarget = targetOn(nextMonday, group.weeklyTarget, tChanges)
  const photoRequired = photoRequiredFor(group)
  const label = (t) => (t >= 7 ? 'every day' : `${t} days a week`)

  const inviteText = `Join my FitPot group "${group.name}"\nPasscode: ${group.passcode}\n${location.origin}${location.pathname}`

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: 'FitPot', text: inviteText }) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(inviteText)
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    }
  }

  async function savePenalty() {
    setSaving(true)
    try { await changePenalty(user, group, penalty); setPenalty('') } finally { setSaving(false) }
  }

  const left = clock.hasLeft(user.uid)
  async function leave() {
    if (!confirm(`Leave "${group.name}"?\n\nYou stop counting from tomorrow (today still counts; in a weekly group, this week still counts). Your past results stay on the Board. You can't rejoin this group later.`)) return
    setSaving(true)
    try { await leaveGroup(user, group, groupIds) } finally { setSaving(false) }
  }

  return (
    <>
      <h2 className="section-title group-title">{group.name}</h2>

      <div className="card passcode-card">
        <p className="muted small">Group passcode</p>
        <p className="passcode">{group.passcode}</p>
        <button className="btn-primary" onClick={share}>{copied ? 'Copied!' : 'Invite friends'}</button>
      </div>

      <h3 className="section-title">Group rules</h3>
      <div className="card form">
        <p className="muted small">Workout target</p>
        <p className="stat-num">{label(target)}{nextTarget !== target && <span className="muted small"> → {label(nextTarget)} from Monday</span>}</p>
        <label>Change target (starts next Monday)
          <select value={nextTarget} disabled={saving} onChange={async (e) => {
            setSaving(true); try { await changeTarget(user, group, +e.target.value) } finally { setSaving(false) }
          }}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} days a week (settled weekly)</option>)}
            <option value={7}>Every day (settled daily)</option>
          </select>
        </label>
        <p className="muted small">
          {target >= 7
            ? 'Each missed day costs the penalty, split among who showed that day.'
            : `Weeks run Monday to Sunday. Anyone under ${target} pays the penalty for each day short; the pot is split among everyone who hit ${target}. Each rest day lowers the target by 1.`}
        </p>
      </div>

      <div className="card form">
        <label className="check">
          <input type="checkbox" checked={photoRequired} disabled={saving} onChange={async (e) => {
            setSaving(true); try { await setPhotoRequired(group, e.target.checked) } finally { setSaving(false) }
          }} />
          Require a live workout photo to check in
        </label>
        <p className="muted small">When on, CHECK IN opens the camera and the photo is the check-in.</p>
      </div>

      <div className="card form">
        <p className="muted small">Penalty per missed workout</p>
        <p className="stat-num">
          {fmt(current, cur, { digits: cur === 'INR' ? 0 : 2 })}
          {(tomorrow !== current || curNext !== cur) && <span className="muted small"> → {fmt(tomorrow, curNext)} from {shortDay(startDay)}</span>}
        </p>
        <label>New penalty ({currencyInfo(curNext).symbol}), starts {shortDay(startDay)}{target < 7 ? ' (weekly groups: from the next Monday\'s week)' : ''}
          <input type="number" min="0" max={MAX_PENALTY} value={penalty} placeholder={String(tomorrow)} onChange={(e) => setPenalty(e.target.value)} />
        </label>
        <button className="btn-ghost" onClick={savePenalty} disabled={saving || penalty === '' || Number(penalty) === tomorrow}>
          {saving ? 'Saving...' : 'Change penalty'}
        </button>
        <p className="muted small">Agree with the group first. Changes are logged and never apply to past days.</p>
      </div>

      <CurrencyCard user={user} group={group} from={curNext} penalty={tomorrow} startDay={startDay} />

      <h3 className="section-title">Members · {members.length}</h3>
      <ul className="member-list">
        {members.map((m) => {
          const tz = clock.tzAt(m.uid)
          return (
            <li key={m.uid}>
              <Avatar member={m} />
              <span className="grow">
                {m.name}{m.uid === user.uid ? ' (you)' : ''}{clock.hasLeft(m.uid) ? ' (left)' : ''}
                <span className="muted small"> · {tzLabel(tz)}, {localTime(tz)}</span>
              </span>
              <span className="muted small">since {shortDay(clock.joinDay(m))}</span>
            </li>
          )
        })}
      </ul>

      <p className="muted small">
        Everyone's day follows their own phone's timezone (yours: {clock.myTz()}). Check-ins, photos and rest votes
        close at each person's own midnight. The group settles a day once it has ended for everyone. If your phone's
        timezone changes, FitPot switches you over from your next day.
      </p>
      {left
        ? <p className="muted small">You left this group. Its history stays visible here.</p>
        : <button className="btn-ghost danger" onClick={leave} disabled={saving}>Leave this group</button>}
      <p className="muted small disclaimer">FitPot tracks informal debts between friends. It doesn't move money. You keep being part of a group's pot until you leave it.</p>
    </>
  )
}

// Switch the pot's currency from tomorrow, converting all past amounts at today's rate.
function CurrencyCard({ user, group, from, penalty, startDay }) {
  const [to, setTo] = useState('')
  const [rate, setRate] = useState('')
  const [newPenalty, setNewPenalty] = useState('')
  const [status, setStatus] = useState('') // '' | 'fetching' | 'saving' | error text
  const pending = group.money.pending()

  async function pick(code) {
    setTo(code); setRate(''); setNewPenalty(''); setStatus('')
    if (!code) return
    setStatus('fetching')
    try {
      const r = await fetchRate(from, code)
      setRate(String(+r.toPrecision(6)))
      setNewPenalty(String(roundPenalty(penalty * r, code)))
      setStatus('')
    } catch (e) { setStatus(e.message) }
  }

  async function save() {
    const r = Number(rate)
    if (!(r > 0)) return setStatus('Enter a rate above 0.')
    if (!confirm(`Switch the pot to ${currencyInfo(to).name}s from ${shortDay(startDay)}?\n\nAll past amounts will show in ${currencyInfo(to).symbol}, converted at 1 ${currencyInfo(from).symbol} = ${r} ${currencyInfo(to).symbol}. This is logged and can't be undone (you can switch again later).`)) return
    setStatus('saving')
    try {
      await changeCurrency(user, group, { from, currency: to, rate: r, penalty: Number(newPenalty) || 0 })
      setTo(''); setRate(''); setNewPenalty(''); setStatus('')
    } catch (e) { setStatus(e.message || String(e)) }
  }

  const busy = status === 'fetching' || status === 'saving'
  return (
    <div className="card form">
      <p className="muted small">Pot currency</p>
      <p className="stat-num">
        {currencyInfo(group.money.current()).symbol} {currencyInfo(group.money.current()).name}
        {pending.length > 0 && <span className="muted small"> → {currencyInfo(pending[pending.length - 1].currency).symbol} from {shortDay(pending[pending.length - 1].effectiveDate)}</span>}
      </p>
      <label>Switch to (starts {shortDay(startDay)})
        <select value={to} disabled={busy} onChange={(e) => pick(e.target.value)}>
          <option value="">Choose a currency...</option>
          {CURRENCIES.filter((c) => c.code !== from).map((c) => <option key={c.code} value={c.code}>{c.symbol} {c.name}</option>)}
        </select>
      </label>
      {to && (
        <>
          <label>Today's rate: 1 {currencyInfo(from).symbol} = ? {currencyInfo(to).symbol}
            <input type="number" step="any" min="0" value={rate} disabled={busy} placeholder={status === 'fetching' ? 'Fetching...' : 'e.g. 0.012'}
              onChange={(e) => {
                setRate(e.target.value)
                if (Number(e.target.value) > 0) setNewPenalty(String(roundPenalty(penalty * Number(e.target.value), to)))
              }} />
          </label>
          <label>New penalty ({currencyInfo(to).symbol})
            <input type="number" min="0" max={MAX_PENALTY} value={newPenalty} disabled={busy} onChange={(e) => setNewPenalty(e.target.value)} />
          </label>
          <button className="btn-primary" onClick={save} disabled={busy || !(Number(rate) > 0) || newPenalty === ''}>
            {status === 'saving' ? 'Saving...' : `Switch to ${currencyInfo(to).symbol}`}
          </button>
        </>
      )}
      {status && !busy && <p className="error small">{status}</p>}
      <p className="muted small">
        Rate from the European Central Bank (via Frankfurter), editable. From the switch day, every balance, including
        past months, shows in the new currency, converted at this rate. The penalty is pre-filled at the same rate; round
        it to whatever the group agrees.
      </p>
    </div>
  )
}
