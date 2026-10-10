import { useState } from 'react'
import {
  authMessage, changeName, changePassword, addPassword, logOut, deleteAccount,
  hasPassword, hasGoogle, isVerified, MIN_PASSWORD,
} from '../lib/account'
import VerifyBanner from '../components/VerifyBanner'
import InstallCard from '../components/InstallCard'

// Account (gear icon, top right): name, sign-in methods, password, sign out, delete account.
export default function Account({ user, groupIds, profile }) {
  const [, bump] = useState(0) // re-render after Firebase updates the user object
  const refresh = () => bump((n) => n + 1)
  const pw = hasPassword(user), google = hasGoogle(user)

  return (
    <section>
      <h2>Account</h2>
      <div className="card">
        <p><strong>{user.displayName || 'No name yet'}</strong></p>
        <p className="muted small">{user.email}</p>
        <p className="muted small">
          Sign-in: {[google && 'Google', pw && 'email + password'].filter(Boolean).join(' · ')}
          {' · '}{isVerified(user) ? <span className="lime">email verified</span> : <span className="orange">email not verified</span>}
        </p>
      </div>
      <VerifyBanner user={user} onVerified={refresh} />

      <NameCard user={user} groupIds={groupIds} onDone={refresh} />
      {pw ? <ChangePasswordCard user={user} /> : <AddPasswordCard user={user} onDone={refresh} />}

      <h3 className="section-title">App</h3>
      <InstallCard always />

      <button className="btn-ghost wide" onClick={logOut}>Sign out</button>

      <DeleteCard user={user} groupIds={[...new Set([...groupIds, ...(profile?.leftGroupIds || [])])]} />
    </section>
  )
}

function useAction() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ text: '', error: false })
  async function run(fn, ok) {
    setBusy(true); setMsg({ text: '', error: false })
    try { await fn(); if (ok) setMsg({ text: ok, error: false }) } catch (e) { setMsg({ text: authMessage(e), error: true }) } finally { setBusy(false) }
  }
  const note = msg.text ? <p className={msg.error ? 'error small' : 'lime small'}>{msg.text}</p> : null
  return { busy, run, note }
}

function NameCard({ user, groupIds, onDone }) {
  const [name, setName] = useState(user.displayName || '')
  const { busy, run, note } = useAction()
  return (
    <form className="card form" onSubmit={(e) => { e.preventDefault(); run(async () => { await changeName(user, name, groupIds); onDone() }, 'Name updated.') }}>
      <label>Display name (what friends see)
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
      </label>
      <button className="btn-ghost" disabled={busy || !name.trim() || name.trim() === user.displayName}>{busy ? 'Saving...' : 'Save name'}</button>
      {note}
    </form>
  )
}

function PasswordInput({ label, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <label>{label}
      <span className="pw-wrap">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required />
        <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
      </span>
    </label>
  )
}

function ChangePasswordCard({ user }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const { busy, run, note } = useAction()
  return (
    <form className="card form" onSubmit={(e) => { e.preventDefault(); run(async () => { await changePassword(user, current, next); setCurrent(''); setNext('') }, 'Password changed.') }}>
      <p className="muted small">Change password</p>
      <PasswordInput label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordInput label={`New password (at least ${MIN_PASSWORD} characters)`} value={next} onChange={setNext} autoComplete="new-password" />
      <button className="btn-ghost" disabled={busy || !current || next.length < MIN_PASSWORD}>{busy ? 'Saving...' : 'Change password'}</button>
      {note}
    </form>
  )
}

function AddPasswordCard({ user, onDone }) {
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const { busy, run, note } = useAction()
  const mismatch = again && next !== again
  return (
    <form className="card form" onSubmit={(e) => { e.preventDefault(); run(async () => { await addPassword(user, next); setNext(''); setAgain(''); onDone() }, `Done. You can now also sign in with ${user.email} and this password.`) }}>
      <p className="muted small">Add a password, so you can also sign in with your email ({user.email}) and a password, not only Google.</p>
      <PasswordInput label={`Password (at least ${MIN_PASSWORD} characters)`} value={next} onChange={setNext} autoComplete="new-password" />
      <PasswordInput label="Type it again" value={again} onChange={setAgain} autoComplete="new-password" />
      {mismatch && <p className="error small">The two passwords don't match.</p>}
      <button className="btn-ghost" disabled={busy || next.length < MIN_PASSWORD || next !== again}>{busy ? 'Saving...' : 'Add password'}</button>
      {note}
    </form>
  )
}

function DeleteCard({ user, groupIds }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [typed, setTyped] = useState('')
  const { busy, run, note } = useAction()
  const pw = hasPassword(user)

  if (!open) return <button className="btn-ghost wide danger" onClick={() => setOpen(true)}>Delete my account...</button>
  return (
    <form className="card form danger-card" onSubmit={(e) => { e.preventDefault(); run(() => deleteAccount(user, { currentPassword: current, groupIds })) }}>
      <p><strong>Delete my account</strong></p>
      <ul className="muted small">
        <li>Deletes your login and everything in <strong>Me</strong>: food log, training, weight, measurements, targets.</li>
        <li>You leave every group. Your past check-ins stay so friends' balances don't change, but your name shows as "Former member".</li>
        <li>Progress photos in your own Google Drive stay there (they're your files). Workout photos stay in the group organiser's Drive.</li>
        <li>This can't be undone. Export your data first (Me → Targets) if you want a copy.</li>
      </ul>
      {pw
        ? <PasswordInput label="Your password, to confirm it's you" value={current} onChange={setCurrent} autoComplete="current-password" />
        : <p className="muted small">You'll confirm with Google in a pop-up.</p>}
      <label>Type DELETE to confirm
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" />
      </label>
      <button className="btn-primary danger-btn" disabled={busy || typed !== 'DELETE' || (pw && !current)}>{busy ? 'Deleting...' : 'Delete everything'}</button>
      <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      {note}
    </form>
  )
}
