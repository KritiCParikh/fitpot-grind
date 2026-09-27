import { useState } from 'react'
import { leaveGroupLocally, joinDay, changePenalty } from '../lib/group'
import { prettyDay, todayInTz, addDays } from '../lib/dates'
import { penaltyOn } from '../lib/ledger'
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

      <div className="card form">
        <p className="muted small">Daily penalty</p>
        <p className="stat-num">${current}{tomorrow !== current && <span className="muted small"> → ${tomorrow} from tomorrow</span>}</p>
        <label>New penalty ($), starts tomorrow
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
