import { useState } from 'react'
import { createGroup, joinGroup } from '../lib/group'
import { isVerified } from '../lib/account'
import VerifyBanner from './VerifyBanner'
import { localTz } from '../lib/clock'
import { CURRENCIES, currencyInfo, guessCurrency, MAX_PENALTY } from '../lib/money'

// Join a group with its passcode, or create one. Used in the Group tab; you
// can be in several groups and switch between them.
export default function JoinCreate({ user, onDone }) {
  const [, setVerified] = useState(0)
  const [mode, setMode] = useState('join')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState(() => guessCurrency(localTz()))
  const [penalty, setPenalty] = useState(() => currencyInfo(guessCurrency(localTz())).defaultPenalty)
  const [weeklyTarget, setWeeklyTarget] = useState(4)
  const [photoRequired, setPhotoRequired] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Groups need a confirmed email (the Firestore rules check this too).
  if (!isVerified(user)) return <VerifyBanner user={user} onVerified={() => setVerified((n) => n + 1)} />

  async function run(fn) {
    setBusy(true); setError('')
    try { await fn(); onDone?.() } catch (e) { setError(e.message || String(e)) } finally { setBusy(false) }
  }

  return (
    <div className="join-create">

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
          <button className="btn-primary" disabled={busy || code.length < 6}>{busy ? 'Joining...' : 'Join'}</button>
        </form>
      ) : (
        <form className="card form" onSubmit={(e) => { e.preventDefault(); run(() => createGroup(user, { name, penalty, weeklyTarget, photoRequired, currency })) }}>
          <label>Group name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning Grinders" maxLength={40} />
          </label>
          <label>Workout days per week
            <select value={weeklyTarget} onChange={(e) => setWeeklyTarget(+e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} days a week (settled weekly)</option>)}
              <option value={7}>Every day (settled daily)</option>
            </select>
          </label>
          <label>Pot currency
            <select value={currency} onChange={(e) => { setCurrency(e.target.value); setPenalty(currencyInfo(e.target.value).defaultPenalty) }}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.symbol} {c.name}</option>)}
            </select>
          </label>
          <label>Penalty ({currencyInfo(currency).symbol}) per missed workout
            <input type="number" min="0" max={MAX_PENALTY} step="1" value={penalty} onChange={(e) => setPenalty(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={photoRequired} onChange={(e) => setPhotoRequired(e.target.checked)} />
            Require a live workout photo to check in
          </label>
          <p className="muted small">Start low ({currency === 'INR' ? '₹50 to 200' : `${currencyInfo(currency).symbol}5 to 10`}). You can change all of these later, including the currency.</p>
          <button className="btn-primary" disabled={busy}>{busy ? 'Creating...' : 'Create group'}</button>
        </form>
      )}

      {error && <p className="error small">{error}</p>}
    </div>
  )
}
