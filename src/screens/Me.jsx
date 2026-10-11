import { useState } from 'react'
import { NUTRIENTS } from '../lib/foods'
import { useSettings, saveSettings, useMealsOn, LB_PER_KG } from '../lib/privateData'
import FoodLog from './FoodLog'
import Progress from './Progress'
import Training, { TRAINING_SECTIONS } from './Training'
import Measurements from '../components/Measurements'
import ExportData from '../components/ExportData'
import VerifyBanner from '../components/VerifyBanner'
import InstallCard from '../components/InstallCard'
import { useLocation, useNavigate } from 'react-router-dom'
import MeBar, { ME_TABS } from '../nav/MeBar'
import FoodPlate from '../nav/FoodPlate'
import { myToday } from '../lib/clock'
import { local } from '../lib/device'

// "Me": everything personal and private. Nobody in any group sees this tab's
// data. It's where you land after signing in, and it works without a group.
//
// Sections (phase 5.7): Food, Training (Log, Muscles, Records, Routines,
// Setup), Progress, Targets. The current one lives in the address
// (#/?me=training&t=records), so the menu, shortcuts and Back all work.
// The bottom barbell switches sections. Tapping the Food plate again opens
// the food plate. Training switches with its tabs at the top (phase 5.7.1).
export default function Me({ user }) {
  const params = new URLSearchParams(useLocation().search)
  const navigate = useNavigate()
  const tab = ME_TABS.some((t) => t.key === params.get('me')) ? params.get('me') : 'food'
  const lastSection = local.get('fitpot-training-section')
  const section = TRAINING_SECTIONS.some((s) => s.key === params.get('t')) ? params.get('t')
    : TRAINING_SECTIONS.some((s) => s.key === lastSection) ? lastSection : 'log'
  const [chooser, setChooser] = useState(null) // null | 'plate'
  const [foodCmd, setFoodCmd] = useState(null) // what the food plate asked the diary to open
  const [, bump] = useState(0) // re-render once your email is confirmed

  const go = (me, t) => navigate(`/?me=${me}${me === 'training' ? `&t=${t || section}` : ''}`)
  function onTab(key) {
    if (key === tab && key === 'training') return // already here: the tabs at the top switch sections
    if (key === tab && key === 'food') return setChooser('plate')
    go(key)
  }
  const sectionLabel = TRAINING_SECTIONS.find((s) => s.key === section)?.label

  return (
    <section className="me-page">
      <h2>Me <span className="h2-sub">{ME_TABS.find((t) => t.key === tab).label}{tab === 'training' ? `: ${sectionLabel}` : ''}</span></h2>
      <VerifyBanner user={user} onVerified={() => bump((n) => n + 1)} />
      <InstallCard />
      {tab === 'food' && <FoodLog user={user} command={foodCmd} onOpenPlate={() => setChooser('plate')} />}
      {tab === 'training' && (
        <Training user={user} section={section} onSection={(t) => {
          local.set('fitpot-training-section', t)
          go('training', t)
        }} />
      )}
      {tab === 'progress' && <Progress user={user} />}
      {tab === 'targets' && <Targets user={user} />}

      <MeBar tab={tab} sectionLabel={sectionLabel} onTab={onTab} />
      {chooser === 'plate' && <FoodPlateFor user={user} onClose={() => setChooser(null)} onPick={(w) => {
        setChooser(null)
        setFoodCmd({ w, n: Date.now() })
      }} />}
    </section>
  )
}

// The food plate with today's calories per meal.
function FoodPlateFor({ user, onPick, onClose }) {
  const meals = useMealsOn(user.uid, myToday())
  const settings = useSettings(user.uid)
  const byMeal = {}
  let total = 0
  for (const m of meals || []) { const k = m.nutrients?.kcal || 0; byMeal[m.meal] = (byMeal[m.meal] || 0) + k; total += k }
  return <FoodPlate kcalByMeal={byMeal} total={total} target={settings?.targets?.kcal} onPick={onPick} onClose={onClose} />
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
