import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { leaveGroupLocally, joinDay } from '../lib/group'
import { prettyDay } from '../lib/dates'
import Avatar from '../components/Avatar'

export default function Group({ user, group, members }) {
  const [copied, setCopied] = useState(false)
  const [penalty, setPenalty] = useState(group.penalty)
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
    try { await updateDoc(doc(db, 'groups', group.id), { penalty: Number(penalty) || 0 }) } finally { setSaving(false) }
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
        <label>Daily penalty ($)
          <input type="number" min="0" max="100" value={penalty} onChange={(e) => setPenalty(e.target.value)} />
        </label>
        <button className="btn-ghost" onClick={savePenalty} disabled={saving || Number(penalty) === group.penalty}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <p className="muted small">Agree on changes with the group first. Voting comes in a later phase.</p>
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
