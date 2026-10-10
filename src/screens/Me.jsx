import { useState } from 'react'
import { NUTRIENTS } from '../lib/foods'
import { useSettings, saveSettings, LB_PER_KG } from '../lib/privateData'
import FoodLog from './FoodLog'
import Progress from './Progress'
import Training from './Training'
import Measurements from '../components/Measurements'
import ExportData from '../components/ExportData'
import VerifyBanner from '../components/VerifyBanner'
import InstallCard from '../components/InstallCard'
import { useLocation } from 'react-router-dom'

const TABS = [
  { key: 'food', label: 'Food' },
  { key: 'training', label: 'Training' },
  { key: 'progress', label: 'Progress' },
  { key: 'targets', label: 'Targets' },
]

// "Me": everything personal and private. Nobody in any group sees this tab's
// data. It's where you land after signing in, and it works without a group.
export default function Me({ user }) {
  // Home screen shortcuts open e.g. #/?me=training
  const wanted = new URLSearchParams(useLocation().search).get('me')
  const [tab, setTab] = useState(TABS.some((t) => t.key === wanted) ? wanted : 'food')
  const [, bump] = useState(0) // re-render once your email is confirmed
  return (
    <section>
      <h2>Me</h2>
      <VerifyBanner user={user} onVerified={() => bump((n) => n + 1)} />
      <InstallCard />
      <div className="segmented tabs3">
        {TABS.map((t) => <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>
      {tab === 'food' && <FoodLog user={user} />}
      {tab === 'training' && <Training user={user} />}
      {tab === 'progress' && <Progress user={user} />}
      {tab === 'targets' && <Targets user={user} />}
    </section>
  )
}

function Targets({ user }) {
  const settings = useSettings(user.uid)
  if (settings === undefined) return <p className="muted">Loading...</p>
  return (
    <>
      <TargetsForm key={settings ? 'loaded' : 'empty'} uid={user.uid} settings={settings || {}} />
      <h3 className="section-title">Body measurements</h3>
      <Measurements uid={user.uid} settings={settings || {}} />
      <h3 className="section-title">Your data</h3>
      <ExportData uid={user.uid} />
    </>
  )
}

function TargetsForm({ uid, settings }) {
  const unit0 = settings.weightUnit || 'kg'
  const [unit, setUnit] = useState(unit0)
  const [dist, setDist] = useState(settings.distanceUnit || 'km')
  const [targets, setTargets] = useState(Object.fromEntries(NUTRIENTS.map((n) => [n.key, settings.targets?.[n.key] ?? ''])))
  const toDisp = (kg, u) => (kg ? Math.round((u === 'lb' ? kg * LB_PER_KG : kg) * 10) / 10 : '')
  const [goal, setGoal] = useState(toDisp(settings.goalWeightKg, unit0))
  const [saved, setSaved] = useState(false)

  async function save(e) {
    e.preventDefault()
    const g = Number(goal)
    await saveSettings(uid, {
      targets: Object.fromEntries(NUTRIENTS.map((n) => [n.key, Number(targets[n.key]) || 0])),
      weightUnit: unit,
      distanceUnit: dist,
      goalWeightKg: g ? (unit === 'lb' ? g / LB_PER_KG : g) : null,
    })
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }

  return (
    <form className="card form" onSubmit={save}>
      <p className="muted small">Your own daily targets. All optional; leave any blank to skip it. (AI suggested targets to come later, from our very own model.)</p>
      <div className="nutri-inputs">
        {NUTRIENTS.map((n) => (
          <label key={n.key}>{n.label} ({n.unit}/day)
            <input className="text-input" type="number" inputMode="numeric" min="0" value={targets[n.key]} onChange={(e) => setTargets((t) => ({ ...t, [n.key]: e.target.value }))} />
          </label>
        ))}
      </div>
      <div className="row">
        <label className="grow">Weight unit
          <select value={unit} onChange={(e) => {
            const u = e.target.value
            const g = Number(goal)
            if (g) setGoal(Math.round((u === 'lb' ? g * LB_PER_KG : g / LB_PER_KG) * 10) / 10)
            setUnit(u)
          }}>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </label>
        <label className="grow">Distance unit
          <select value={dist} onChange={(e) => setDist(e.target.value)}>
            <option value="km">km</option>
            <option value="mi">miles</option>
          </select>
        </label>
      </div>
      <div className="row">
        <label className="grow">Goal weight ({unit}, optional)
          <input className="text-input" type="number" inputMode="decimal" step="0.1" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </label>
      </div>
      <button className="btn-primary">{saved ? 'Saved' : 'Save targets'}</button>
      <p className="muted small">Private to you.</p>
    </form>
  )
}
