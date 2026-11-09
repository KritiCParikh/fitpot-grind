import { useMemo, useState } from 'react'
import {
  MUSCLES, EQUIPMENT, EXERCISE_CATS, muscleLabel, muscleText, partLabel, doable, regionsOf, fromRegion,
  isCardio, exerciseCat, alsoOf, alsoText, builtIn,
} from '../lib/training'
import { addCustomExercise, updateCustomExercise, deleteCustomExercise, editBuiltInExercise, resetBuiltInExercise } from '../lib/privateData'
import BodyMap from './BodyMap'

// Full-screen exercise finder: search, pick a group (Gym, Cardio machines,
// Outdoor, Sports; phase 5.12.1), a muscle (and, optionally, a specific part)
// from the dropdowns or by tapping the body map, optionally only what your
// equipment allows, and create or edit exercises.
// Exercises picked while a part is chosen are logged against that part, so
// the muscle map can show exactly what you trained (phase 5.10).
// Every exercise can be edited (phase 5.12.1): your own ones are changed in
// place; a suggested one gets your version (same key, so history stays) with
// "Reset to FitPot's version".
export default function ExercisePicker({ uid, exercises, have, onPick, onClose, title = 'Add exercise' }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [muscle, setMuscle] = useState('')
  const [part, setPart] = useState('')
  const [onlyMine, setOnlyMine] = useState(have.size > 0)
  const [form, setForm] = useState(null) // null | { ex } (ex null = create)

  const mine = exercises.filter((e) => e.custom)
  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return exercises
      .filter((e) => (!cat || (cat === 'mine' ? e.custom : exerciseCat(e) === cat))
        && (!muscle || e.muscle === muscle || alsoOf(e).some((k) => k === muscle || k === part || regionsOf(muscle).includes(k)))
        && (!term || e.name.toLowerCase().includes(term))
        && (!onlyMine || e.custom || doable(e, have)))
      // Main muscle first, then exercises that also work it; with a part chosen, ones that target it first.
      .sort((a, b) => (muscle ? (b.muscle === muscle ? 1 : 0) - (a.muscle === muscle ? 1 : 0) : 0)
        || (part ? (b.part === part ? 1 : 0) - (a.part === part ? 1 : 0) : 0)
        || (b.custom ? 1 : 0) - (a.custom ? 1 : 0) || a.name.localeCompare(b.name))
  }, [exercises, q, cat, muscle, part, onlyMine, have])

  // The chosen part goes with the exercise, unless it already targets a part.
  const pick = (e) => onPick(part && !e.part && e.muscle === muscle ? { ...e, part } : e)

  if (form) {
    return <ExerciseForm uid={uid} ex={form.ex} startCat={cat && cat !== 'mine' ? cat : 'gym'} onClose={() => setForm(null)}
      onSaved={(ex) => { setForm(null); if (ex && !form.ex) onPick(ex) }} />
  }

  const showMuscles = !cat || cat === 'gym' || cat === 'mine'
  return (
    <div className="sheet">
      <div className="sheet-head">
        <h3>{title}</h3>
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>
      <input className="text-input search" placeholder="Search exercises, runs, sports" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="chips ex-cats" role="group" aria-label="Kind of exercise">
        {[{ key: '', label: 'All' }, ...EXERCISE_CATS, ...(mine.length ? [{ key: 'mine', label: `My exercises (${mine.length})` }] : [])].map((c) => (
          <button key={c.key || 'all'} type="button" className={`chip ${cat === c.key ? 'on' : ''}`} aria-pressed={cat === c.key}
            onClick={() => { setCat(c.key); if (c.key && c.key !== 'gym' && c.key !== 'mine') { setMuscle(''); setPart('') } }}>{c.label}</button>
        ))}
      </div>
      {showMuscles && <MusclePicker muscle={muscle} part={part} onChange={(m, pt) => { setMuscle(m); setPart(pt) }} />}
      {have.size > 0 && (
        <label className="check small muted">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Only what my equipment allows
        </label>
      )}
      <ul className="food-list ex-list">
        {list.map((e) => (
          <li key={e.key}>
            <button className="grow" onClick={() => pick(e)}>
              <span className="grow-col">
                <span className="food-name">{e.name}{e.custom ? <span className="muted small"> (mine)</span> : e.edited ? <span className="muted small"> (edited)</span> : null}</span>
                <span className="muted small">{subline(e)}</span>
              </span>
            </button>
            <button type="button" className="btn-ghost ex-edit" aria-label={`Edit ${e.name}`} onClick={() => setForm({ ex: e })}>Edit</button>
          </li>
        ))}
        {!list.length && <li className="muted small">No match. Create it below.</li>}
      </ul>
      <button className="btn-ghost wide" onClick={() => setForm({ ex: null })}>+ Create your own exercise</button>
      {mine.length > 0 && cat !== 'mine' && (
        <p className="muted small">To change or delete one of your own exercises, tap <strong>My exercises</strong> above, then <strong>Edit</strong>.</p>
      )}
    </div>
  )
}

const CAT_LABEL = { machine: 'Cardio machine', outdoor: 'Outdoor', sports: 'Sport' }
function subline(e) {
  if (isCardio(e)) return CAT_LABEL[exerciseCat(e)] || 'Cardio'
  const also = alsoOf(e)
  return muscleText(e.muscle, e.part) + (also.length ? ` · also ${alsoText(also)}` : '')
}

/**
 * Muscle dropdown, then an optional specific part, with the body map beside
 * them. Tapping the body sets both. onChange(muscle, part); '' means all / any.
 */
export function MusclePicker({ muscle, part, onChange, allowAll = true, also = [] }) {
  const m = MUSCLES.find((x) => x.key === muscle)
  const parts = m?.parts || []
  const bright = part ? [part] : parts.length ? [] : regionsOf(muscle)
  const soft = [...regionsOf(muscle).filter((r) => !bright.includes(r)), ...also.flatMap((k) => (partLabel(k) ? [k] : regionsOf(k)))]
  return (
    <div className="muscle-pick">
      <div className="muscle-selects form">
        <label>{allowAll ? 'Muscle' : 'Main muscle'}
          <select value={muscle} onChange={(e) => onChange(e.target.value, '')}>
            {allowAll && <option value="">All muscles</option>}
            {MUSCLES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
        </label>
        <label>Specific part (optional)
          <select value={part} disabled={!parts.length} onChange={(e) => onChange(muscle, e.target.value)}>
            <option value="">{parts.length ? 'Any' : 'None for this muscle'}</option>
            {parts.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
        </label>
        <p className="muscle-caption">{muscle
          ? <><span className="lime">{(part ? partLabel(part) : muscleLabel(muscle)).toUpperCase()}</span>{part && <span className="muted"> in {muscleLabel(muscle)}</span>}</>
          : <span className="muted">Tap a muscle on the body to pick it</span>}</p>
      </div>
      <BodyMap bright={bright} soft={soft} size={120} onPick={(region) => {
        const hit = fromRegion(region)
        if (hit) onChange(hit.muscle, hit.part)
      }} />
    </div>
  )
}

// Muscles you can add as "also works": every group with a body map spot.
const ALSO_CHOICES = MUSCLES.filter((m) => !m.noMap)

/**
 * Create or edit an exercise (phase 5.12.1).
 *   ex null      create your own
 *   ex.custom    edit your own (or delete it)
 *   otherwise    edit a suggested one: saved as your version, Reset brings FitPot's back
 * Kind: Gym (main muscle, optional part, muscles it also works) or a kind of
 * cardio (machine, outdoor, sport).
 */
function ExerciseForm({ uid, ex, startCat = 'gym', onClose, onSaved }) {
  const original = ex && !ex.custom ? builtIn(ex.key) : null
  const [name, setName] = useState(ex?.name || '')
  const [cat, setCat] = useState(ex ? exerciseCat(ex) : startCat)
  const [muscle, setMuscle] = useState(ex && !isCardio(ex) ? ex.muscle : 'chest')
  const [part, setPart] = useState(ex?.part || '')
  const [also, setAlso] = useState(() => (ex ? alsoOf(ex) : []))
  const [eq, setEq] = useState(ex?.eq?.filter((e) => e !== 'bodyweight') || [])
  const [metric, setMetric] = useState(ex && isCardio(ex) ? ex.metric || 'distance' : 'distance')
  const [busy, setBusy] = useState(false)
  const gym = cat === 'gym'
  // Cardio kinds lock their own way of logging for suggested ones; your own outdoor or machine can pick.
  const cardioMetric = cat === 'sports' ? 'effort' : original?.metric || (metric === 'effort' ? 'distance' : metric)

  const toggleAlso = (k) => setAlso((l) => (l.includes(k) || l.some((x) => partLabel(x) && regionsOf(k).includes(x)) ? l.filter((x) => x !== k && !(partLabel(x) && regionsOf(k).includes(x))) : [...l, k]))
  const alsoOn = (k) => also.includes(k) || also.some((x) => partLabel(x) && regionsOf(k).includes(x))

  function data() {
    const base = { name: name.trim(), eq }
    if (gym) return { ...base, muscle, part: part || '', also: also.filter((k) => k !== muscle && !regionsOf(muscle).includes(k)) }
    return { ...base, muscle: 'cardio', kind: 'cardio', cat, metric: cardioMetric, part: '', also: [], ...(original?.countLabel ? { countLabel: original.countLabel } : {}) }
  }

  async function save(e) {
    e?.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      const d = data()
      if (!ex) {
        const ref = await addCustomExercise(uid, d)
        onSaved({ key: `my:${ref.id}`, ...d, eq: d.eq.length ? d.eq : ['bodyweight'], custom: true, id: ref.id })
      } else if (ex.custom) {
        await updateCustomExercise(uid, ex.id, d)
        onSaved(null)
      } else {
        await editBuiltInExercise(uid, ex.key, { ...d, eq: d.eq.length ? d.eq : original.eq })
        onSaved(null)
      }
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm(`Delete "${ex.name}"? Workouts you already logged keep it.`)) return
    await deleteCustomExercise(uid, ex.id)
    onSaved(null)
  }
  async function reset() {
    if (!confirm(`Bring back FitPot's "${original.name}"? Your changes to it go.`)) return
    await resetBuiltInExercise(uid, ex.key)
    onSaved(null)
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <h3>{!ex ? 'Create exercise' : ex.custom ? 'Edit my exercise' : 'Edit exercise'}</h3>
        <button className="btn-ghost" onClick={onClose}>Back</button>
      </div>
      {original && <p className="muted small">This is one of FitPot's suggestions. Your changes apply only to you, and your history with it stays.</p>}
      <form className="card form" onSubmit={save}>
        <label>Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={cat === 'sports' ? 'e.g. Gully cricket' : 'e.g. Hammer Strength chest press'} maxLength={60} />
        </label>
        <div className="form-field">
          <span className="muted small">Kind</span>
          <div className="chips" role="group" aria-label="Kind">
            {EXERCISE_CATS.map((c) => (
              <button key={c.key} type="button" disabled={Boolean(original) && (c.key === 'gym') !== (exerciseCat(original) === 'gym')}
                className={`chip ${cat === c.key ? 'on' : ''}`} aria-pressed={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</button>
            ))}
          </div>
        </div>
        {!gym && cat !== 'sports' && !original && (
          <label>How you log it
            <select value={metric === 'time' ? 'time' : 'distance'} onChange={(e) => setMetric(e.target.value)}>
              <option value="distance">Distance and time</option>
              <option value="time">Time and a count (floors, laps)</option>
            </select>
          </label>
        )}
        {cat === 'sports' && <p className="muted small">Sports log minutes and how hard it felt (easy, moderate, hard).</p>}
      </form>
      {gym && (
        <>
          <MusclePicker muscle={muscle} part={part} allowAll={false} also={also} onChange={(m, pt) => { setMuscle(m); setPart(pt) }} />
          <div className="card form">
            <p className="muted small">Also works (optional). Each one gets half a set in Training, Muscles.</p>
            <div className="chips also-chips">
              {ALSO_CHOICES.filter((m) => m.key !== muscle).map((m) => (
                <button type="button" key={m.key} className={`chip ${alsoOn(m.key) ? 'on' : ''}`} aria-pressed={alsoOn(m.key)} onClick={() => toggleAlso(m.key)}>{m.label}</button>
              ))}
            </div>
            {also.length > 0 && <p className="muted small">{muscleText(muscle, part)}, also {alsoText(also)}</p>}
          </div>
        </>
      )}
      <form className="card form" onSubmit={save}>
        <p className="muted small">Equipment it needs (optional)</p>
        <div className="chips">
          {EQUIPMENT.map((x) => (
            <button type="button" key={x.key} className={`chip ${eq.includes(x.key) ? 'on' : ''}`}
              onClick={() => setEq((l) => (l.includes(x.key) ? l.filter((k) => k !== x.key) : [...l, x.key]))}>{x.label}</button>
          ))}
        </div>
        <button className="btn-primary" disabled={busy || !name.trim()}>{busy ? 'Saving...' : !ex ? 'Save and add' : 'Save changes'}</button>
      </form>
      {ex?.custom && <button className="btn-ghost wide danger" onClick={remove}>Delete this exercise</button>}
      {ex?.edited && <button className="btn-ghost wide" onClick={reset}>Reset to FitPot's version</button>}
    </div>
  )
}
