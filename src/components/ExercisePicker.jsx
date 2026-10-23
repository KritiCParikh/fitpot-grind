import { useMemo, useState } from 'react'
import { MUSCLES, EQUIPMENT, muscleLabel, muscleText, partLabel, doable, regionsOf, fromRegion } from '../lib/training'
import { addCustomExercise, deleteCustomExercise } from '../lib/privateData'
import BodyMap from './BodyMap'

// Full-screen exercise finder: search, pick a muscle (and, optionally, a
// specific part) from the dropdowns or by tapping the body map, optionally
// only what your equipment allows, and create your own exercises.
// Exercises picked while a part is chosen are logged against that part, so
// the muscle map can show exactly what you trained (phase 5.10).
export default function ExercisePicker({ uid, exercises, have, onPick, onClose, title = 'Add exercise' }) {
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [part, setPart] = useState('')
  const [onlyMine, setOnlyMine] = useState(have.size > 0)
  const [creating, setCreating] = useState(false)

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return exercises
      .filter((e) => (!muscle || e.muscle === muscle) && (!term || e.name.toLowerCase().includes(term)) && (!onlyMine || e.custom || doable(e, have)))
      // With a part chosen, exercises that target it come first.
      .sort((a, b) => (part ? (b.part === part ? 1 : 0) - (a.part === part ? 1 : 0) : 0)
        || (b.custom ? 1 : 0) - (a.custom ? 1 : 0) || a.name.localeCompare(b.name))
  }, [exercises, q, muscle, part, onlyMine, have])

  // The chosen part goes with the exercise, unless it already targets a part.
  const pick = (e) => onPick(part && !e.part && e.muscle === muscle ? { ...e, part } : e)

  if (creating) return <CreateExercise uid={uid} onClose={() => setCreating(false)} onCreated={(ex) => { setCreating(false); onPick(ex) }} />

  return (
    <div className="sheet">
      <div className="sheet-head">
        <h3>{title}</h3>
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>
      <input className="text-input search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <MusclePicker muscle={muscle} part={part} onChange={(m, pt) => { setMuscle(m); setPart(pt) }} />
      {have.size > 0 && (
        <label className="check small muted">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Only what my equipment allows
        </label>
      )}
      <ul className="food-list">
        {list.map((e) => (
          <li key={e.key}>
            <button onClick={() => pick(e)}>
              <span className="grow-col">
                <span className="food-name">{e.name}{e.custom ? <span className="muted small"> (mine)</span> : null}</span>
                <span className="muted small">{muscleText(e.muscle, e.part)}</span>
              </span>
            </button>
          </li>
        ))}
        {!list.length && <li className="muted small">No match. Create it below.</li>}
      </ul>
      <button className="btn-ghost wide" onClick={() => setCreating(true)}>+ Create your own exercise</button>
      {exercises.some((e) => e.custom) && (
        <details className="history">
          <summary>Manage my exercises</summary>
          <ul className="member-list">
            {exercises.filter((e) => e.custom).map((e) => (
              <li key={e.key}>
                <span className="grow">{e.name} <span className="muted small">· {muscleText(e.muscle, e.part)}</span></span>
                <button className="btn-ghost" aria-label={`Delete ${e.name}`} onClick={() => confirm(`Delete "${e.name}"? Past workouts keep their entries.`) && deleteCustomExercise(uid, e.id)}>✕</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

/**
 * Muscle dropdown, then an optional specific part, with the body map beside
 * them. Tapping the body sets both. onChange(muscle, part); '' means all / any.
 */
export function MusclePicker({ muscle, part, onChange, allowAll = true }) {
  const m = MUSCLES.find((x) => x.key === muscle)
  const parts = m?.parts || []
  const bright = part ? [part] : parts.length ? [] : regionsOf(muscle)
  const soft = regionsOf(muscle).filter((r) => !bright.includes(r))
  return (
    <div className="muscle-pick">
      <div className="muscle-selects form">
        <label>Muscle
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

function CreateExercise({ uid, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState('chest')
  const [part, setPart] = useState('')
  const [eq, setEq] = useState([])
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      const ref = await addCustomExercise(uid, { name: name.trim(), muscle, eq, ...(part ? { part } : {}) })
      onCreated({ key: `my:${ref.id}`, name: name.trim(), muscle, ...(part ? { part } : {}), eq: eq.length ? eq : ['bodyweight'], custom: true, id: ref.id })
    } finally { setBusy(false) }
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <h3>Create exercise</h3>
        <button className="btn-ghost" onClick={onClose}>Back</button>
      </div>
      <form className="card form" onSubmit={save}>
        <label>Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hammer Strength chest press" maxLength={60} autoFocus />
        </label>
      </form>
      <MusclePicker muscle={muscle} part={part} allowAll={false} onChange={(m, pt) => { setMuscle(m); setPart(pt) }} />
      <form className="card form" onSubmit={save}>
        <p className="muted small">Equipment it needs (optional)</p>
        <div className="chips">
          {EQUIPMENT.map((x) => (
            <button type="button" key={x.key} className={`chip ${eq.includes(x.key) ? 'on' : ''}`}
              onClick={() => setEq((l) => (l.includes(x.key) ? l.filter((k) => k !== x.key) : [...l, x.key]))}>{x.label}</button>
          ))}
        </div>
        <button className="btn-primary" disabled={busy || !name.trim()}>{busy ? 'Saving...' : 'Save and add'}</button>
      </form>
    </div>
  )
}
