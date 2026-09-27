import { useState } from 'react'
import { leaveGroupLocally, joinDay, changePenalty, changeTarget, setPhotoRequired, photoRequiredFor } from '../lib/group'
import { prettyDay, todayInTz, addDays, mondayOf } from '../lib/dates'
import { penaltyOn, targetOn } from '../lib/ledger'
import { useLedgerInputs } from '../lib/useLedger'
import Avatar from '../components/Avatar'

export default function Group({ user, group, members }) {
  const [copied, setCopied] = useState(false)
  const today = todayInTz(group.timezone)
  const inputs = useLedgerInputs(group, today, today)
  const changes = inputs?.penaltyChanges || []
  const current = penaltyOn(today, group.penalty, changes)
  const tomorrow = penaltyOn(addDays(today, 1), group.penalty, changes)
  const [penalty, setPenalty] = useState('')
  const [saving, setSaving] = useState(false)
  const nextMonday = addDays(mondayOf(today), 7)
  const tChanges = inputs?.targetChanges || []
  const target = targetOn(today, group.weeklyTarget, tChanges)
  const nextTarget = targetOn(nextMonday, group.weeklyTarget, tChanges)
  const photoRequired = photoRequiredFor(group)
  const label = (t) => (t >= 7 ? 'every day' : `${t} days a week`)

  const inviteText = `Join my FitPot group "${group.name}" 💪\nPasscode: ${group.passcode}\n${location.origin}${location.pathname}`

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

  return (
    <section>
      <h2>{group.name}</h2>

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
            : `Weeks run Mon–Sun. Anyone under ${target} pays the penalty for each day short; the pot is split among everyone who hit ${target}. Each rest day lowers the target by 1.`}
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
        <p className="stat-num">${current}{tomorrow !== current && <span className="muted small"> → ${tomorrow} from tomorrow</span>}</p>
        <label>New penalty ($), starts tomorrow{target < 7 ? ' (weekly groups: from next Monday\'s week)' : ''}
          <input type="number" min="0" max="100" value={penalty} placeholder={String(tomorrow)} onChange={(e) => setPenalty(e.target.value)} />
        </label>
        <button className="btn-ghost" onClick={savePenalty} disabled={saving || penalty === '' || Number(penalty) === tomorrow}>
          {saving ? 'Saving…' : 'Change penalty'}
        </button>
        <p className="muted small">Agree with the group first. Changes are logged and never apply to past days.</p>
      </div>

      <h3 className="section-title">Members · {members.length}</h3>
      <ul className="member-list">
        {members.map((m) => (
          <li key={m.uid}>
            <Avatar member={m} />
            <span className="grow">{m.name}{m.uid === user.uid ? ' (you)' : ''}</span>
            <span className="muted small">since {prettyDay(joinDay(m, group.timezone)).split(', ').slice(1).join(', ')}</span>
          </li>
        ))}
      </ul>

      <p className="muted small">Times use {group.timezone}. The day closes at midnight there.</p>
      <button className="btn-ghost" onClick={() => leaveGroupLocally(user)}>Switch group</button>
      <p className="muted small disclaimer">FitPot tracks informal debts between friends. It doesn't move money.</p>
    </section>
  )
}
