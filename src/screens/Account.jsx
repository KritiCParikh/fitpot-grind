import { useState } from 'react'
import {
  authMessage, changeName, changePassword, addPassword, logOut, deleteAccount,
  hasPassword, hasGoogle, isVerified, MIN_PASSWORD,
} from '../lib/account'
import VerifyBanner from '../components/VerifyBanner'
import InstallCard from '../components/InstallCard'
import RemindersCard from '../components/RemindersCard'
import { TEXT_SIZES, getTextSize, applyTextSize } from '../nav/textSize'
import { useSettings, saveSettings, LB_PER_KG, CM_PER_IN } from '../lib/privateData'

export default function Account({ user, groupIds, profile }) {
  const [, bump] = useState(0)
  const refresh = () => bump((n) => n + 1)
  const pw = hasPassword(user), google = hasGoogle(user)
  const settings = useSettings(user.uid)

  return (
    <section>
      <h2>Account</h2>

      <h3 className="section-title">About me</h3>
      <AboutMeCard uid={user.uid} settings={settings || {}} />

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
      <RemindersCard user={user} />
      <TextSizeCard />
      <InstallCard always />

      <button className="btn-ghost wide" onClick={logOut}>Sign out</button>

      <DeleteCard user={user} groupIds={[...new Set([...groupIds, ...(profile?.leftGroupIds || [])])]} />
    </section>
  )
}

function AboutMeCard({ uid, settings }) {
  const [dob, setDob] = useState(settings.dob || '')
  const [sex, setSex] = useState(settings.sex || '')
  const [height, setHeight] = useState(settings.height || '')
  const [weight, setWeight] = useState(settings.weight || '')
  const [unit, setUnit] = useState(settings.weightUnit || 'kg')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await saveSettings(uid, { dob, sex, height, weight: weight ? Number(weight) : null, weightUnit: unit })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      console.error('Failed to save:', e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card form" onSubmit={save}>
      <p className="muted small">Used for calorie calculator and 18+ check.</p>
      <label>Date of birth
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
      </label>
      <label>Sex
        <select value={sex} onChange={(e) => setSex(e.target.value)} required>
          <option value="">Choose</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
        </select>
      </label>
      <label>Height (cm)
        <input type="number" inputMode="numeric" min="100" max="250" value={height} onChange={(e) => setHeight(e.target.value)} required />
      </label>
      <div className="row">
        <label className="grow">Weight ({unit})
          <input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required />
        </label>
        <label className="grow">Unit
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </label>
      </div>
      <button className="btn-primary" disabled={busy || !dob || !sex || !height || !weight}>{saved ? 'Saved' : 'Save'}</button>
      <p className="muted small">Private to you.</p>
    </form>
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

function TextSizeCard() {
  const [size, setSize] = useState(getTextSize)
  return (
    <div className="card form">
      <p className="muted small">Text size</p>
      <div className="segmented text-size">
        {TEXT_SIZES.map((t) => (
          <button key={t.key} type="button" className={size === t.key ? 'on' : ''} style={{ fontSize: `${t.px * 0.85}px` }}
            onClick={() => { applyTextSize(t.key); setSize(t.key) }}>{t.label}</button>
        ))}
      </div>
    </div>
  )
}
