import { useMemo, useState } from 'react'
import { MUSCLES, EQUIPMENT, muscleLabel, doable } from '../lib/training'
import { addCustomExercise, deleteCustomExercise } from '../lib/privateData'

// Full-screen exercise finder: search, filter by muscle group, optionally only
// what your equipment allows, and create your own exercises.
export default function ExercisePicker({ uid, exercises, have, onPick, onClose, title = 'Add exercise' }) {
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [onlyMine, setOnlyMine] = useState(have.size > 0)
  const [creating, setCreating] = useState(false)

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return exercises
      .filter((e) => (!muscle || e.muscle === muscle) && (!term || e.name.toLowerCase().includes(term)) && (!onlyMine || e.custom || doable(e, have)))
      .sort((a, b) => (b.custom ? 1 : 0) - (a.custom ? 1 : 0) || a.name.localeCompare(b.name))
  }, [exercises, q, muscle, onlyMine, have])

  if (creating) return <CreateExercise uid={uid} onClose={() => setCreating(false)} onCreated={(ex) => { setCreating(false); onPick(ex) }} />

  return (
    <div className="sheet">
      <div className="sheet-head">
        <h3>{title}</h3>
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>
      <input className="text-input search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="chips">
        <button className={`chip ${!muscle ? 'on' : ''}`} onClick={() => setMuscle('')}>All</button>
        {MUSCLES.map((m) => <button key={m.key} className={`chip ${muscle === m.key ? 'on' : ''}`} onClick={() => setMuscle(muscle === m.key ? '' : m.key)}>{m.label}</button>)}
      </div>
      {have.size > 0 && (
        <label className="check small muted">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Only what my equipment allows
        </label>
      )}
      <ul className="food-list">
        {list.map((e) => (
          <li key={e.key}>
            <button onClick={() => onPick(e)}>
              <span className="grow-col">
                <span className="food-name">{e.name}{e.custom ? <span className="muted small"> (mine)</span> : null}</span>
                <span className="muted small">{muscleLabel(e.muscle)}</span>
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
                <span className="grow">{e.name} <span className="muted small">· {muscleLabel(e.muscle)}</span></span>
                <button className="btn-ghost" aria-label={`Delete ${e.name}`} onClick={() => confirm(`Delete "${e.name}"? Past workouts keep their entries.`) && deleteCustomExercise(uid, e.id)}>✕</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function CreateExercise({ uid, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState('chest')
  const [eq, setEq] = useState([])
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      const ref = await addCustomExercise(uid, { name: name.trim(), muscle, eq })
      onCreated({ key: `my:${ref.id}`, name: name.trim(), muscle, eq: eq.length ? eq : ['bodyweight'], custom: true, id: ref.id })
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
        <label>Main muscle group
          <select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
            {MUSCLES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
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
