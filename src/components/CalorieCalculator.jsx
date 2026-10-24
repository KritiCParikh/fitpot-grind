import { useMemo, useState } from 'react'
import { ACTIVITY, GOALS, calculate } from '../lib/calories'
import { saveSettings, useWeights, LB_PER_KG, CM_PER_IN } from '../lib/privateData'

// Me > Targets > Calorie calculator (phase 5.11). Built in, nothing leaves the
// phone except your saved details, which stay private like the rest of Me.
// A starting point for people learning to count calories, with a plain
// explainer of what a calorie is.
export default function CalorieCalculator({ uid, settings }) {
  const weights = useWeights(uid)
  const saved = settings.calculator || {}
  const unit = settings.weightUnit || 'kg'
  const dobString = settings.dob          // was: const dob
  const settingsSex = settings.sex        // was: const sex
  const settingsHeight = settings.height  // was: const savedHeight
  const settingsWeight = settings.weight  // was: const savedWeight
  const latestKg = useMemo(() => {
    const list = [...(weights || [])].sort((a, b) => a.date.localeCompare(b.date))
    return list.length ? list[list.length - 1].kg : null
  }, [weights])
  const [age, setAge] = useState(dobString ? calculateAge(dobString) : saved.age ?? '')
  const [sex, setSex] = useState(settingsSex || saved.sex ?? '')
  const [hUnit, setHUnit] = useState(saved.heightUnit || 'cm')
  const [cm, setCm] = useState((settingsHeight || saved.heightCm) ?? '')
  const [ft, setFt] = useState(settingsHeight ? Math.floor(settingsHeight / CM_PER_IN / 12) : '')
  const [inch, setInch] = useState(settingsHeight ? Math.round((settingsHeight / CM_PER_IN) % 12) : '')
  const [weight, setWeight] = useState('')
  const [activity, setActivity] = useState(saved.activity || 'moderate')
  const [goal, setGoal] = useState(saved.goal || 'maintain')
  const [done, setDone] = useState(false)

  const heightCm = hUnit === 'cm' ? Number(cm) : ((Number(ft) || 0) * 12 + (Number(inch) || 0)) * CM_PER_IN
  const typedKg = weight === '' ? null : unit === 'lb' ? Number(weight) / LB_PER_KG : Number(weight)
  const weightKg = typedKg ?? latestKg
  const result = calculate({ age, sex, heightCm, weightKg, activity, goal })
  const shownWeight = weight !== '' ? weight : latestKg ? String(Math.round((unit === 'lb' ? latestKg * LB_PER_KG : latestKg) * 10) / 10) : ''

  async function use() {
    if (!result) return
    await saveSettings(uid, {
      targets: { kcal: result.target, protein: result.protein, carbs: result.carbs, fat: result.fat, fibre: result.fibre },
      calculator: { age: Number(age), sex, heightCm: Math.round(heightCm), heightUnit: hUnit, activity, goal },
    })
    setDone(true); setTimeout(() => setDone(false), 2000)
  }

  return (
    <div className="card form calc">
      <p className="muted small">New to counting calories? This gives you a starting point. Adjust it after a few weeks based on how you feel and how your weight moves.</p>
      <div className="row">
        <label className="grow">Age
          <input className="text-input" type="number" inputMode="numeric" min="18" max="100" value={age} onChange={(e) => setAge(e.target.value)} />
        </label>
        <label className="grow">Sex
          <select value={sex} onChange={(e) => setSex(e.target.value)}>
            <option value="">Choose...</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
      </div>
      <div className="row">
        {hUnit === 'cm' ? (
          <label className="grow">Height (cm)
            <input className="text-input" type="number" inputMode="decimal" min="100" max="250" value={cm} onChange={(e) => setCm(e.target.value)} />
          </label>
        ) : (
          <>
            <label className="grow">Height (ft)
              <input className="text-input" type="number" inputMode="numeric" min="3" max="8" value={ft} onChange={(e) => setFt(e.target.value)} />
            </label>
            <label className="grow">(in)
              <input className="text-input" type="number" inputMode="numeric" min="0" max="11" value={inch} onChange={(e) => setInch(e.target.value)} />
            </label>
          </>
        )}
        <span className="unit-switch calc-unit" role="group" aria-label="Height unit">
          {['cm', 'ft'].map((o) => <button key={o} type="button" className={hUnit === o ? 'on' : ''} aria-pressed={hUnit === o} onClick={() => setHUnit(o)}>{o}</button>)}
        </span>
      </div>
      <label>Weight ({unit}){latestKg && weight === '' ? <span className="muted"> from your weight log</span> : null}
        <input className="text-input" type="number" inputMode="decimal" step="0.1" value={shownWeight} onChange={(e) => setWeight(e.target.value)} />
      </label>
      <label>How active are you?
        <select value={activity} onChange={(e) => setActivity(e.target.value)}>
          {ACTIVITY.map((a) => <option key={a.key} value={a.key}>{a.label} ({a.note})</option>)}
        </select>
      </label>
      <label>Your goal
        <select value={goal} onChange={(e) => setGoal(e.target.value)}>
          {GOALS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
      </label>

      {result ? (
        <div className="calc-result">
          <div className="calc-big"><b>{result.target.toLocaleString()}</b><span>kcal a day</span></div>
          <ul className="calc-lines">
            <li><span>Resting burn</span><span>{result.bmr.toLocaleString()} kcal</span></li>
            <li><span>With your activity</span><span>{result.maintenance.toLocaleString()} kcal</span></li>
            <li><span>Protein</span><span>{result.protein} g</span></li>
            <li><span>Carbs</span><span>{result.carbs} g</span></li>
            <li><span>Fat</span><span>{result.fat} g</span></li>
            <li><span>Fibre</span><span>{result.fibre} g</span></li>
          </ul>
          {result.floored && <p className="small orange">We kept this at a level your body can comfortably run on. Slow and steady wins here.</p>}
          <button type="button" className="btn-primary" onClick={use}>{done ? 'Saved as your targets' : 'Use as my targets'}</button>
          <p className="muted small">You can still change any target by hand above.</p>
        </div>
      ) : Number(age) > 0 && Number(age) < 18
        ? <p className="muted small">This calculator is made for adults. Growing bodies need their own numbers, so a doctor or a parent is the best guide here.</p>
        : <p className="muted small">Fill in your age, sex, height and weight to see your numbers.</p>}

      <details className="history calc-learn">
        <summary>How calories work</summary>
        <div className="small">
          <p><strong>Think of your body as a phone.</strong> Food is the charger and a calorie is a unit of charge. Everything you do uses some of it.</p>
          <p><strong>Resting burn</strong> is the battery draining while the phone sits on the table with the screen off: breathing, a beating heart, staying warm, a busy brain. For most people this is the biggest share of the day.</p>
          <p><strong>Activity</strong> is the apps you open: walking, workouts, climbing stairs, even fidgeting. Digesting food uses a little charge too, roughly a tenth of what you eat.</p>
          <p><strong>Where the charge comes from:</strong> every gram of protein gives about 4 kcal, carbs about 4, fat about 9, and alcohol about 7. Fibre counts as a carb but gives much less.</p>
          <p><strong>A quick example.</strong> A roti with about 3 g protein, 18 g carbs and 3 g fat: 3 x 4 = 12, plus 18 x 4 = 72, plus 3 x 9 = 27. That's about 111 kcal.</p>
          <p><strong>The power bank.</strong> Charge more than you use and your body saves the extra in its power bank, mostly as fat. Charge a little less and it quietly draws from the bank. Roughly 7,700 kcal is about 1 kg of body fat, so 500 kcal less each day is about half a kilo a week.</p>
          <p><strong>Protein</strong> is the repair kit for muscles after training, which is why the calculator suggests about 1.6 g for every kg you weigh.</p>
          <p className="muted">These are estimates for adults. If you're under 18, pregnant or managing a health condition, a doctor or dietitian can set numbers that fit you.</p>
        </div>
      </details>
    </div>
  )
}
