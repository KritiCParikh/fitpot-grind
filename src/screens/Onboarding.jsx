import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { createGroup, joinGroup } from '../lib/group'

export default function Onboarding({ user }) {
  const [mode, setMode] = useState('join')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [penalty, setPenalty] = useState(5)
  const [weeklyTarget, setWeeklyTarget] = useState(4)
  const [photoRequired, setPhotoRequired] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(fn) {
    setBusy(true); setError('')
    try { await fn() } catch (e) { setError(e.message || String(e)) } finally { setBusy(false) }
  }

  return (
    <main className="center onboarding">
      <h1 className="logo">FitPot</h1>
      <p className="muted">Hi {user.displayName?.split(' ')[0] || 'there'}. Join your crew or start one.</p>

      <div className="segmented">
        <button className={mode === 'join' ? 'on' : ''} onClick={() => setMode('join')}>Join group</button>
        <button className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>Create group</button>
      </div>

      {mode === 'join' ? (
        <form className="card form" onSubmit={(e) => { e.preventDefault(); run(() => joinGroup(user, code)) }}>
          <label>Group passcode
            <input
              value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. K7QM3X" maxLength={6} autoCapitalize="characters" required
              className="code-input"
            />
          </label>
          <button className="btn-primary" disabled={busy || code.length < 6}>{busy ? 'Joining…' : 'Join'}</button>
        </form>
      ) : (
        <form className="card form" onSubmit={(e) => { e.preventDefault(); run(() => createGroup(user, { name, penalty, weeklyTarget, photoRequired })) }}>
          <label>Group name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning Grinders" maxLength={40} />
          </label>
          <label>Workout days per week
            <select value={weeklyTarget} onChange={(e) => setWeeklyTarget(+e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} days a week (settled weekly)</option>)}
              <option value={7}>Every day (settled daily)</option>
            </select>
          </label>
          <label>Penalty ($) per missed workout
            <input type="number" min="0" max="100" step="1" value={penalty} onChange={(e) => setPenalty(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={photoRequired} onChange={(e) => setPhotoRequired(e.target.checked)} />
            Require a live workout photo to check in
          </label>
          <p className="muted small">Start low ($5–10). You can change these later.</p>
          <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create group'}</button>
        </form>
      )}

      {error && <p className="error small">{error}</p>}
      <button className="btn-ghost" onClick={() => signOut(auth)}>Sign out</button>
    </main>
  )
}
