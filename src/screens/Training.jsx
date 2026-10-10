import { useMemo, useState } from 'react'
import {
  useTraining, saveTraining, useWorkouts, useCustomExercises, useRoutines, saveRoutine, deleteRoutine, useSettings, LB_PER_KG,
} from '../lib/privateData'
import {
  MUSCLES, EQUIPMENT, muscleLabel, allExercises, personalRecords, weekByMuscle, historyOf, units,
} from '../lib/training'
import { addDays, prettyDay, mondayOf } from '../lib/dates'
import { myToday } from '../lib/clock'
import WorkoutEditor from '../components/WorkoutEditor'
import ExercisePicker from '../components/ExercisePicker'
import WeightChart from '../components/WeightChart'

const VIEWS = [
  { key: 'log', label: '📝 Log' },
  { key: 'muscles', label: '💪 Muscles' },
  { key: 'records', label: '🏆 Records' },
  { key: 'routines', label: '📋 Routines' },
  { key: 'setup', label: '⚙️ Setup' },
]
const short = (d) => prettyDay(d).split(', ').slice(1).join(', ')

// Me → Training: a private progressive-overload tracker.
export default function Training({ user }) {
  const uid = user.uid
  const today = myToday()
  const training = useTraining(uid)
  const settings = useSettings(uid)
  const rawWorkouts = useWorkouts(uid)
  const custom = useCustomExercises(uid)
  const routines = useRoutines(uid)
  const [view, setView] = useState('log')
  const [editor, setEditor] = useState(null) // initial workout for the editor

  const workouts = useMemo(() => (rawWorkouts || []).map((w) => ({ ...w, createdMs: w.createdAt?.toMillis?.() || 0 })), [rawWorkouts])
  const exercises = useMemo(() => allExercises(custom || []), [custom])
  const have = useMemo(() => new Set(training?.equipment || []), [training])
  const u = units(settings?.weightUnit || 'kg')

  if ([training, settings, rawWorkouts, custom, routines].includes(undefined)) return <p className="muted">Loading…</p>

  const t = training || {}
  const ctx = { uid, today, t, workouts, exercises, have, u, routines, start: setEditor }

  return (
    <>
      <div className="chips subtabs">
        {VIEWS.map((v) => <button key={v.key} className={`chip ${view === v.key ? 'on' : ''}`} onClick={() => setView(v.key)}>{v.label}</button>)}
      </div>
      {view === 'log' && <LogView {...ctx} />}
      {view === 'muscles' && <MusclesView {...ctx} />}
      {view === 'records' && <RecordsView {...ctx} />}
      {view === 'routines' && <RoutinesView {...ctx} />}
      {view === 'setup' && <SetupView {...ctx} settings={settings || {}} />}
      {editor && (
        <WorkoutEditor uid={uid} initial={editor} workouts={workouts} exercises={exercises} have={have} u={u}
          restSec={t.restSec ?? 90} today={today} onClose={() => setEditor(null)} />
      )}
    </>
  )
}

// ---------------- Log ----------------
function LogView({ today, t, workouts, u, routines, start }) {
  const [shown, setShown] = useState(20)
  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdMs - a.createdMs)
  const { byWorkout } = useMemo(() => personalRecords(workouts), [workouts])
  const mon = mondayOf(today)
  const thisWeek = workouts.filter((w) => w.date >= mon && w.date <= today)
  const days = new Set(thisWeek.map((w) => w.date)).size
  const last = sorted[0]

  return (
    <>
      <div className="stats-row">
        <div className="card stat">
          <p className="muted small">This week</p>
          <p className={`stat-num ${t.daysPerWeek && days >= t.daysPerWeek ? 'lime' : ''}`}>{days}{t.daysPerWeek ? `/${t.daysPerWeek}` : ''}</p>
          <p className="muted small">training days</p>
        </div>
        <div className="card stat">
          <p className="muted small">Workouts</p>
          <p className="stat-num">{workouts.length}</p>
          <p className="muted small">logged</p>
        </div>
        <div className="card stat">
          <p className="muted small">PRs</p>
          <p className="stat-num lime">{Object.values(byWorkout).reduce((n, l) => n + l.length, 0)}</p>
          <p className="muted small">all time</p>
        </div>
      </div>

      <button className="btn-primary wide" onClick={() => start({ date: today, exercises: [] })}>＋ Start workout</button>
      <div className="action-row">
        {last && <button className="btn-ghost" onClick={() => start({ date: today, title: last.title, exercises: last.exercises.map(fromLast) })}>↻ Repeat last{last.title ? ` (${last.title})` : ''}</button>}
        {(routines || []).map((r) => (
          <button key={r.id} className="btn-ghost" onClick={() => start({ date: today, title: r.name, exercises: r.items.map((it) => fromRoutine(it, workouts)) })}>▶ {r.name}</button>
        ))}
      </div>

      <h3 className="section-title">History</h3>
      {!sorted.length && <div className="card"><p className="muted">No workouts yet. Start one, log each set, and next time FitPot shows you what to beat.</p></div>}
      <ul className="member-list workout-list">
        {sorted.slice(0, shown).map((w) => {
          const sets = w.exercises.reduce((n, x) => n + x.sets.length, 0)
          const vol = w.exercises.reduce((v, x) => v + x.sets.reduce((a, s) => a + s.reps * (s.kg || 0), 0), 0)
          const prs = byWorkout[w.id] || []
          return (
            <li key={w.id}>
              <button className="plain grow-col" onClick={() => start(w)}>
                <strong>{w.title || [...new Set(w.exercises.map((x) => muscleLabel(x.muscle)))].join(' · ')}</strong>
                <span className="muted small">{short(w.date)} · {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'} · {sets} set{sets === 1 ? '' : 's'}{vol ? ` · ${Math.round(u.toDisp(vol)).toLocaleString()} ${u.unit} volume` : ''}</span>
                {w.notes && <span className="muted small">📝 {w.notes}</span>}
              </button>
              {prs.length > 0 && <span className="pill pr">🏆 {prs.length}</span>}
            </li>
          )
        })}
      </ul>
      {sorted.length > shown && <button className="btn-ghost wide" onClick={() => setShown((n) => n + 20)}>Show more</button>}
    </>
  )
}

const fromLast = (x) => ({ key: x.key, name: x.name, muscle: x.muscle, sets: x.sets.map((s) => ({ reps: s.reps, kg: s.kg })) })
function fromRoutine(it, workouts) {
  // Pre-fill each set with last time's weight for that exercise, else empty.
  const h = historyOf(workouts, it.key)
  const kg = h.length ? h[h.length - 1].best?.kg || 0 : 0
  return { key: it.key, name: it.name, muscle: it.muscle, sets: Array.from({ length: it.sets || 3 }, () => ({ reps: it.reps || 0, kg })) }
}

// ---------------- Muscles (weekly progressive overload) ----------------
const ARROW = { up: '▲', down: '▼', same: '＝', new: '★', none: '–' }

function MusclesView({ today, workouts, u }) {
  const [day, setDay] = useState(today)
  const week = useMemo(() => weekByMuscle(workouts, day), [workouts, day])
  const pct = (a, b) => (b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%` : a ? 'new' : '')

  return (
    <>
      <div className="cal-head">
        <button className="btn-ghost" onClick={() => setDay((d) => addDays(d, -7))} aria-label="Previous week">‹</button>
        <strong>Week of {short(week.mon)}</strong>
        <button className="btn-ghost" onClick={() => setDay((d) => addDays(d, 7))} disabled={week.sun >= today} aria-label="Next week">›</button>
      </div>
      <p className="muted small">{week.sessions} workouts this week (last week {week.prevSessions}). Progressive overload: beat each exercise's best set from last week by a rep or a little weight. ▲ beat it · ＝ matched · ▼ dropped · ★ new this week.</p>
      {!week.muscles.length && <div className="card"><p className="muted">Nothing logged this week or last week.</p></div>}
      {week.muscles.map((m) => (
        <details className="card muscle-card" key={m.muscle} open={m.sets > 0}>
          <summary>
            <strong className="grow">{muscleLabel(m.muscle)}</strong>
            <span className="muted small">{m.sets} set{m.sets === 1 ? '' : 's'} <span className={m.sets >= m.prevSets ? 'lime' : 'orange'}>({m.sets - m.prevSets >= 0 ? '+' : ''}{m.sets - m.prevSets})</span></span>
            {m.volume > 0 && <span className="muted small"> · {Math.round(u.toDisp(m.volume)).toLocaleString()} {u.unit} <span className={m.volume >= m.prevVolume ? 'lime' : 'orange'}>{pct(m.volume, m.prevVolume)}</span></span>}
          </summary>
          <ul className="member-list">
            {m.exercises.map((x) => (
              <li key={x.key} className={x.trend === 'up' || x.trend === 'new' ? 'in' : x.trend === 'down' ? 'out' : ''}>
                <span className="grow">{x.name}<br />
                  <span className="muted small">this week {x.best ? u.show(x.best.kg, x.best.reps) : '–'} · last week {x.prevBest ? u.show(x.prevBest.kg, x.prevBest.reps) : '–'}</span>
                </span>
                <span className="pill">{ARROW[x.trend]}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </>
  )
}

// ---------------- Records ----------------
function RecordsView({ workouts, u }) {
  const { records } = useMemo(() => personalRecords(workouts), [workouts])
  const [open, setOpen] = useState(null)
  const [muscle, setMuscle] = useState('')
  const list = Object.entries(records)
    .filter(([, r]) => !muscle || r.muscle === muscle)
    .sort((a, b) => b[1].lastDate.localeCompare(a[1].lastDate))

  if (open) {
    const r = records[open]
    const h = historyOf(workouts, open)
    const points = h.filter((s) => s.best?.e1rm).map((s) => ({ date: s.date, value: u.toDisp(s.best.e1rm) }))
    return (
      <>
        <button className="btn-ghost" onClick={() => setOpen(null)}>‹ All records</button>
        <h3>{r.name}</h3>
        <div className="stats-row">
          <div className="card stat"><p className="muted small">Heaviest</p><p className="stat-num lime">{r.heaviest.kg ? u.toDisp(r.heaviest.kg) : '–'}</p><p className="muted small">{r.heaviest.kg ? `${u.unit} × ${r.heaviest.reps}` : 'bodyweight'}</p></div>
          <div className="card stat"><p className="muted small">Est. 1-rep max</p><p className="stat-num">{r.bestE1rm.value ? u.toDisp(r.bestE1rm.value) : '–'}</p><p className="muted small">{r.bestE1rm.value ? u.unit : ''}</p></div>
          <div className="card stat"><p className="muted small">Most reps</p><p className="stat-num">{r.mostReps.reps}</p><p className="muted small">{r.mostReps.kg ? `at ${u.toDisp(r.mostReps.kg)} ${u.unit}` : 'reps'}</p></div>
        </div>
        {points.length > 1 && (
          <div className="card">
            <p className="muted small">Estimated 1-rep max over time ({u.unit})</p>
            <WeightChart points={points} unit={u.unit} />
          </div>
        )}
        <h3 className="section-title">Sessions · {h.length}</h3>
        <ul className="member-list">
          {[...h].reverse().map((s, i) => (
            <li key={i}>
              <span className="grow">{short(s.date)}<br /><span className="muted small">{s.sets.map((x) => u.show(x.kg, x.reps)).join(', ')}</span></span>
              {s.best?.e1rm > 0 && <span className="muted small">1RM≈{u.toDisp(s.best.e1rm)}</span>}
            </li>
          ))}
        </ul>
        <p className="muted small">Estimated 1-rep max uses the Epley formula: weight × (1 + reps ÷ 30). It lets heavier-fewer and lighter-more sets be compared.</p>
      </>
    )
  }

  return (
    <>
      <div className="chips">
        <button className={`chip ${!muscle ? 'on' : ''}`} onClick={() => setMuscle('')}>All</button>
        {MUSCLES.filter((m) => Object.values(records).some((r) => r.muscle === m.key)).map((m) => (
          <button key={m.key} className={`chip ${muscle === m.key ? 'on' : ''}`} onClick={() => setMuscle(m.key)}>{m.label}</button>
        ))}
      </div>
      {!list.length && <div className="card"><p className="muted">Your personal records appear here once you've logged workouts.</p></div>}
      <ul className="member-list">
        {list.map(([key, r]) => (
          <li key={key}>
            <button className="plain grow-col" onClick={() => setOpen(key)}>
              <strong>{r.name}</strong>
              <span className="muted small">{muscleLabel(r.muscle)} · {r.sessions} sessions · last {short(r.lastDate)}</span>
            </button>
            <span className="pill">{r.heaviest.kg ? u.show(r.heaviest.kg, r.heaviest.reps) : `${r.mostReps.reps} reps`}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

// ---------------- Routines ----------------
function RoutinesView({ uid, routines, exercises, have, workouts, start, today }) {
  const [edit, setEdit] = useState(null)
  if (edit) return <RoutineForm uid={uid} initial={edit} exercises={exercises} have={have} onClose={() => setEdit(null)} />
  return (
    <>
      <p className="muted small">Save the workouts you repeat (e.g. Push / Pull / Legs) and start them in one tap. Weights pre-fill from last time.</p>
      <button className="btn-primary wide" onClick={() => setEdit({ name: '', items: [] })}>＋ New routine</button>
      <ul className="member-list">
        {(routines || []).map((r) => (
          <li key={r.id}>
            <button className="plain grow-col" onClick={() => setEdit(r)}>
              <strong>{r.name}</strong>
              <span className="muted small">{r.items.map((it) => `${it.name} ${it.sets}×${it.reps}`).join(' · ')}</span>
            </button>
            <button className="btn-ghost" onClick={() => start({ date: today, title: r.name, exercises: r.items.map((it) => fromRoutine(it, workouts)) })}>▶ Start</button>
          </li>
        ))}
      </ul>
    </>
  )
}

function RoutineForm({ uid, initial, exercises, have, onClose }) {
  const [name, setName] = useState(initial.name)
  const [items, setItems] = useState(initial.items)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  if (picking) {
    return <ExercisePicker uid={uid} exercises={exercises} have={have} title="Add to routine" onClose={() => setPicking(false)}
      onPick={(ex) => { setPicking(false); setItems((l) => [...l, { key: ex.key, name: ex.name, muscle: ex.muscle, sets: 3, reps: 10 }]) }} />
  }
  const setIt = (i, patch) => setItems((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  async function save() {
    setBusy(true)
    try { await saveRoutine(uid, { id: initial.id, name: name.trim() || 'Routine', items }); onClose() } finally { setBusy(false) }
  }
  return (
    <div className="card form">
      <label>Routine name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push day" maxLength={40} />
      </label>
      {items.map((it, i) => (
        <div className="row routine-row" key={i}>
          <span className="grow">{it.name}</span>
          <input className="text-input mini" type="number" min="1" max="10" value={it.sets} aria-label="Sets" onChange={(e) => setIt(i, { sets: +e.target.value })} />
          <span className="muted">×</span>
          <input className="text-input mini" type="number" min="1" max="50" value={it.reps} aria-label="Reps" onChange={(e) => setIt(i, { reps: +e.target.value })} />
          <button className="btn-ghost" aria-label={`Remove ${it.name}`} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn-ghost" onClick={() => setPicking(true)}>＋ Add exercise</button>
      <button className="btn-primary" onClick={save} disabled={busy || !items.length}>{busy ? 'Saving…' : 'Save routine'}</button>
      <div className="action-row">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        {initial.id && <button className="btn-ghost danger" onClick={async () => { if (confirm('Delete this routine?')) { await deleteRoutine(uid, initial.id); onClose() } }}>Delete</button>}
      </div>
    </div>
  )
}

// ---------------- Setup ----------------
const GOALS = [
  ['muscle', 'Build muscle'], ['strength', 'Get stronger'], ['fatloss', 'Lose fat'],
  ['endurance', 'Endurance / fitness'], ['general', 'General health'],
]
const LEVELS = [['beginner', 'Beginner (under 1 year)'], ['intermediate', 'Intermediate (1–3 years)'], ['advanced', 'Advanced (3+ years)']]

function SetupView({ uid, t, settings }) {
  const [form, setForm] = useState({
    goal: t.goal || '', daysPerWeek: t.daysPerWeek || '', sessionMin: t.sessionMin || '', experience: t.experience || '',
    restSec: t.restSec ?? 90, limitations: t.limitations || '',
  })
  const [equipment, setEquipment] = useState(t.equipment || [])
  const [customEq, setCustomEq] = useState(t.customEquipment || [])
  const [newEq, setNewEq] = useState('')
  const [saved, setSaved] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const unit = settings.weightUnit || 'kg'
  const goalW = settings.goalWeightKg ? Math.round((unit === 'lb' ? settings.goalWeightKg * LB_PER_KG : settings.goalWeightKg) * 10) / 10 : null

  async function save(e) {
    e.preventDefault()
    await saveTraining(uid, {
      goal: form.goal, daysPerWeek: Number(form.daysPerWeek) || null, sessionMin: Number(form.sessionMin) || null,
      experience: form.experience, restSec: Number(form.restSec) || 0, limitations: form.limitations.trim(),
      equipment, customEquipment: customEq,
    })
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }

  return (
    <form className="card form" onSubmit={save}>
      <p className="muted small">What you're training for and what you have. Private to you, and the base for future personalised plans.</p>
      <label>Main goal
        <select value={form.goal} onChange={set('goal')}>
          <option value="">Choose…</option>
          {GOALS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <div className="row">
        <label className="grow">Days per week
          <select value={form.daysPerWeek} onChange={set('daysPerWeek')}>
            <option value="">–</option>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="grow">Session length
          <select value={form.sessionMin} onChange={set('sessionMin')}>
            <option value="">–</option>
            {[30, 45, 60, 75, 90, 120].map((n) => <option key={n} value={n}>{n} min</option>)}
          </select>
        </label>
      </div>
      <div className="row">
        <label className="grow">Experience
          <select value={form.experience} onChange={set('experience')}>
            <option value="">Choose…</option>
            {LEVELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="grow">Rest timer
          <select value={form.restSec} onChange={set('restSec')}>
            {[0, 45, 60, 90, 120, 180, 240].map((n) => <option key={n} value={n}>{n ? `${n} s` : 'Off'}</option>)}
          </select>
        </label>
      </div>
      <p className="muted small">Body weight target: {goalW ? <strong>{goalW} {unit}</strong> : 'not set'} (set in Targets).</p>

      <p className="muted small">Equipment you have (tap to add or remove)</p>
      <div className="chips">
        {EQUIPMENT.map((x) => (
          <button type="button" key={x.key} className={`chip ${equipment.includes(x.key) ? 'on' : ''}`}
            onClick={() => setEquipment((l) => (l.includes(x.key) ? l.filter((k) => k !== x.key) : [...l, x.key]))}>{x.label}</button>
        ))}
      </div>
      {customEq.length > 0 && (
        <div className="chips">
          {customEq.map((n) => <button type="button" key={n} className="chip on" onClick={() => setCustomEq((l) => l.filter((x) => x !== n))}>{n} ✕</button>)}
        </div>
      )}
      <div className="row">
        <input className="text-input grow" value={newEq} onChange={(e) => setNewEq(e.target.value)} placeholder="Add other equipment (e.g. 2–24 kg adjustable dumbbells)" maxLength={50} />
        <button type="button" className="btn-ghost" disabled={!newEq.trim()} onClick={() => { setCustomEq((l) => [...new Set([...l, newEq.trim()])]); setNewEq('') }}>Add</button>
      </div>

      <label>Limitations / injuries (optional)
        <textarea className="text-input" rows={3} value={form.limitations} onChange={set('limitations')} placeholder="e.g. Left knee: no deep squats. Lower back: avoid heavy deadlifts." />
      </label>
      <button className="btn-primary">{saved ? 'Saved ✓' : 'Save setup'}</button>
      <p className="muted small">Exercise lists use your equipment to suggest what you can do. Remember to save after changes.</p>
    </form>
  )
}
