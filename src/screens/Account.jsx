import { useState } from 'react'
import {
  authMessage, changeName, changePassword, addPassword, logOut, deleteAccount,
  hasPassword, hasGoogle, isVerified, MIN_PASSWORD,
} from '../lib/account'
import VerifyBanner from '../components/VerifyBanner'
import InstallCard from '../components/InstallCard'
import RemindersCard from '../components/RemindersCard'
import { TEXT_SIZES, getTextSize, applyTextSize } from '../nav/textSize'
import UnitSwitch from '../components/UnitSwitch'
import { useSettings, saveSettings, useWeights, logWeight, LB_PER_KG } from '../lib/privateData'
import { myToday } from '../lib/clock'
import { ageOn } from '../lib/dates'

// Account (gear icon, top right): name, sign-in methods, password, sign out, delete account.
export default function Account({ user, groupIds, profile }) {
  const [, bump] = useState(0) // re-render after Firebase updates the user object
  const refresh = () => bump((n) => n + 1)
  const pw = hasPassword(user), google = hasGoogle(user)

  return (
    <section>
      <h2>Account</h2>
      <AboutMeCard user={user} />
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
      <UnitsCard user={user} />
      <RemindersCard user={user} />
      <TextSizeCard />
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

// Bigger or smaller text across the whole app, saved on this phone.
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

// Units for the whole app: weight (kg | lb) and distance (km | mi). The same
// setting Targets, Progress and the workout logger use, so changing it here
// changes it everywhere.
function UnitsCard({ user }) {
  const settings = useSettings(user.uid)
  if (settings === undefined) return null
  const weight = settings?.weightUnit || 'kg'
  const dist = settings?.distanceUnit || 'km'
  return (
    <div className="card units-card">
      <p><strong>Units</strong></p>
      <div className="units-row">
        <UnitSwitch label="Weight" value={weight} options={['kg', 'lb']} onChange={(v) => saveSettings(user.uid, { weightUnit: v })} />
        <UnitSwitch label="Distance" value={dist} options={['km', 'mi']} onChange={(v) => saveSettings(user.uid, { distanceUnit: v })} />
      </div>
      <p className="muted small">Used everywhere: weight log, workouts, targets. Everything you've logged is converted, nothing is lost.</p>
    </div>
  )
}

// About me (phase 5.12, from the prototype): date of birth, sex, height and
// weight, entered once. They fill the calorie calculator in Targets. Weight
// shows your latest log; saving a new one adds it to your weight log. All
// private to you (private/{uid}/settings/main.about and weights).
function AboutMeCard({ user }) {
  const settings = useSettings(user.uid)
  const weights = useWeights(user.uid)
  if (settings === undefined || weights === undefined) return null
  return <AboutMeForm uid={user.uid} settings={settings || {}} weights={weights || []} />
}

function AboutMeForm({ uid, settings, weights }) {
  const today = myToday()
  const about = settings.about || {}
  const calc = settings.calculator || {}
  const unit = settings.weightUnit || 'kg'
  const latest = [...weights].sort((a, b) => a.date.localeCompare(b.date)).pop()
  const toUnit = (kg, u) => Math.round((u === 'lb' ? kg * LB_PER_KG : kg) * 10) / 10
  const [dob, setDob] = useState(about.dob || '')
  const [sex, setSex] = useState(about.sex || calc.sex || '')
  const [cm, setCm] = useState(about.heightCm ?? calc.heightCm ?? '')
  const [w, setW] = useState('') // typed weight, in `unit`; empty shows the latest log
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const shownW = w !== '' ? w : latest ? String(toUnit(latest.kg, unit)) : ''
  const age = ageOn(dob, today)

  function switchUnit(next) {
    if (next === unit) return
    if (w !== '' && Number(w)) setW(String(Math.round((next === 'lb' ? Number(w) * LB_PER_KG : Number(w) / LB_PER_KG) * 10) / 10))
    saveSettings(uid, { weightUnit: next })
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await saveSettings(uid, { about: { dob: dob || null, sex: sex || null, heightCm: Number(cm) ? Math.round(Number(cm)) : null } })
      const typed = Number(w)
      if (w !== '' && typed > 0) {
        const kg = unit === 'lb' ? typed / LB_PER_KG : typed
        if (!latest || Math.abs(kg - latest.kg) > 0.04) await logWeight(uid, today, kg)
        setW('')
      }
      setSaved(true); setTimeout(() => setSaved(false), 1500)
    } finally { setBusy(false) }
  }

  return (
    <form className="card form about-me" onSubmit={save}>
      <p><strong>About me</strong></p>
      <label>Date of birth
        <input className="text-input" type="date" max={today} value={dob} onChange={(e) => setDob(e.target.value)} />
      </label>
      {age != null && age < 18 && <p className="muted small">The calorie calculator is made for adults (18 and up), so it won't show numbers yet.</p>}
      <div className="about-field">
        <span className="about-label">Sex</span>
        <div className="about-sex" role="group" aria-label="Sex">
          {[['female', 'Female'], ['male', 'Male']].map(([v, l]) => (
            <button key={v} type="button" className={sex === v ? 'on' : ''} aria-pressed={sex === v} onClick={() => setSex(v)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="row">
        <label className="grow">Height (cm)
          <input className="text-input" type="number" inputMode="decimal" min="100" max="250" placeholder="170" value={cm} onChange={(e) => setCm(e.target.value)} />
        </label>
        <label className="grow">Weight ({unit})
          <input className="text-input" type="number" inputMode="decimal" step="0.1" min="20" max="900" placeholder={unit === 'lb' ? '163' : '74'} value={shownW} onChange={(e) => setW(e.target.value)} />
        </label>
      </div>
      <UnitSwitch label="Weight" value={unit} options={['kg', 'lb']} onChange={switchUnit} />
      <button className="btn-primary" disabled={busy}>{busy ? 'Saving...' : saved ? 'Saved' : 'Save About me'}</button>
      <p className="muted small">These fill your calorie calculator, so you only enter them once. Weight shows your latest log, and changing it here adds a new entry to your weight log. Private to you.</p>
    </form>
  )
}
