import { useState } from 'react'
import { saveWorkout, deleteWorkout } from '../lib/privateData'
import { muscleLabel, lastTime, beatIt, personalRecords } from '../lib/training'
import ExercisePicker from './ExercisePicker'
import RestTimer from './RestTimer'

const PR_LABEL = { weight: 'Heaviest weight', e1rm: 'Best estimated 1-rep max', reps: 'Most reps' }

// Log a workout: exercises → sets (weight × reps). Shows "last time" and a
// target to beat for each exercise, runs the rest timer when you tick a set,
// and celebrates new personal records when you save.
//
// `initial`: an existing workout to edit, or { date, title, exercises } to start from.
export default function WorkoutEditor({ uid, initial, workouts, exercises, have, u, restSec = 90, today, onClose }) {
  const [date, setDate] = useState(initial.date || today)
  const [title, setTitle] = useState(initial.title || '')
  const [notes, setNotes] = useState(initial.notes || '')
  const [items, setItems] = useState(() => (initial.exercises || []).map((ex) => ({
    key: ex.key, name: ex.name, muscle: ex.muscle,
    sets: (ex.sets?.length ? ex.sets : [{}]).map((s) => ({ w: s.kg ? String(u.toDisp(s.kg)) : '', reps: s.reps ? String(s.reps) : '', done: Boolean(initial.id) })),
  })))
  const [picking, setPicking] = useState(false)
  const [rest, setRest] = useState(null) // { endAt, total }
  const [busy, setBusy] = useState(false)
  const [prs, setPrs] = useState(null)
  const others = workouts.filter((w) => w.id !== initial.id)
  const stepKg = u.unit === 'lb' ? 5 / 2.20462 : 2.5

  const setItem = (i, fn) => setItems((l) => l.map((x, j) => (j === i ? fn(x) : x)))
  const setSet = (i, k, patch) => setItem(i, (x) => ({ ...x, sets: x.sets.map((s, j) => (j === k ? { ...s, ...patch } : s)) }))

  function addExercise(ex) {
    setPicking(false)
    const last = lastTime(others, ex.key, { before: date })
    // Pre-fill from last time so it's quick to log, and easy to beat.
    const sets = last ? last.sets.map((s) => ({ w: s.kg ? String(u.toDisp(s.kg)) : '', reps: String(s.reps), done: false })) : [{ w: '', reps: '', done: false }]
    setItems((l) => [...l, { key: ex.key, name: ex.name, muscle: ex.muscle, sets }])
  }

  function tick(i, k) {
    const s = items[i].sets[k]
    setSet(i, k, { done: !s.done })
    if (!s.done && Number(s.reps) > 0 && restSec) setRest({ endAt: Date.now() + restSec * 1000, total: restSec })
  }

  async function save() {
    const clean = items
      .map((x) => ({ key: x.key, name: x.name, muscle: x.muscle, sets: x.sets.filter((s) => Number(s.reps) > 0).map((s) => ({ reps: Math.round(Number(s.reps)), kg: Math.round(u.toKg(s.w) * 100) / 100 })) }))
      .filter((x) => x.sets.length)
    if (!clean.length) return alert('Add at least one set with reps.')
    setBusy(true)
    try {
      const w = { id: initial.id, date, title: title.trim(), notes: notes.trim(), exercises: clean }
      await saveWorkout(uid, w)
      // Which records did this workout set?
      const mine = personalRecords([...others, { ...w, id: '__this__', createdMs: Date.now() }]).byWorkout.__this__ || []
      if (mine.length) setPrs(mine); else onClose()
    } catch (e) { alert(e.message || String(e)) } finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm('Delete this workout?')) return
    await deleteWorkout(uid, initial.id)
    onClose()
  }

  if (prs) {
    return (
      <div className="sheet">
        <div className="card pr-card">
          <p className="pr-big">🏆</p>
          <h3>{prs.length} new personal record{prs.length > 1 ? 's' : ''}!</h3>
          <ul className="member-list">
            {prs.map((p, i) => (
              <li key={i} className="in">
                <span className="grow">{p.name}<br /><span className="muted small">{PR_LABEL[p.kind]}</span></span>
                <span className="pill">{p.kind === 'weight' ? u.show(p.value, p.reps) : p.kind === 'e1rm' ? `${u.toDisp(p.value)} ${u.unit}` : `${p.value} reps`}</span>
              </li>
            ))}
          </ul>
          <button className="btn-primary wide" onClick={onClose}>Nice 💪</button>
        </div>
      </div>
    )
  }

  if (picking) return <ExercisePicker uid={uid} exercises={exercises} have={have} onPick={addExercise} onClose={() => setPicking(false)} />

  return (
    <div className="sheet">
      <div className="sheet-head">
        <h3>{initial.id ? 'Edit workout' : 'Workout'}</h3>
        <button className="btn-ghost" onClick={() => (items.length && !initial.id ? confirm('Discard this workout?') : true) && onClose()}>Close</button>
      </div>
      <div className="row form">
        <label className="grow">Name (optional)
          <input className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Push day" maxLength={40} />
        </label>
        <label>Date
          <input className="text-input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
        </label>
      </div>

      {items.map((x, i) => {
        const last = lastTime(others, x.key, { before: date })
        const goal = beatIt(last, { stepKg })
        return (
          <div className="card ex-card" key={i}>
            <div className="ex-head">
              <span className="grow-col">
                <strong>{x.name}</strong>
                <span className="muted small">{muscleLabel(x.muscle)}</span>
              </span>
              <button className="btn-ghost" aria-label={`Remove ${x.name}`} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}>✕</button>
            </div>
            {last
              ? <p className="muted small">Last time ({new Date(last.date + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}): {last.sets.map((s) => u.show(s.kg, s.reps)).join(', ')}{goal && <> · <span className="lime">beat it: {u.show(goal.kg, goal.reps)}</span></>}</p>
              : <p className="muted small">First time logging this. Today sets your baseline.</p>}
            <div className="set-grid">
              <span className="muted small">Set</span><span className="muted small">{u.unit}</span><span className="muted small">Reps</span><span /><span />
              {x.sets.map((s, k) => (
                <SetRow key={k} n={k + 1} s={s}
                  onChange={(patch) => setSet(i, k, patch)}
                  onTick={() => tick(i, k)}
                  onRemove={() => setItem(i, (y) => ({ ...y, sets: y.sets.filter((_, j) => j !== k) }))} />
              ))}
            </div>
            <button className="link-btn" onClick={() => setItem(i, (y) => ({ ...y, sets: [...y.sets, { ...(y.sets[y.sets.length - 1] || { w: '', reps: '' }), done: false }] }))}>＋ Add set</button>
          </div>
        )
      })}

      <button className="btn-ghost wide" onClick={() => setPicking(true)}>＋ Add exercise</button>
      <label className="form notes">Notes (how it felt, form cues, anything)
        <textarea className="text-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Shoulder felt tight on the last set" />
      </label>
      <button className="btn-primary wide" onClick={save} disabled={busy || !items.length}>{busy ? 'Saving…' : 'Save workout'}</button>
      {initial.id && <button className="btn-ghost wide danger" onClick={remove}>Delete workout</button>}
      <p className="muted small">Private to you. Bodyweight exercises: leave weight empty (or enter extra weight, e.g. a dip belt).</p>

      {rest && <RestTimer endAt={rest.endAt} total={rest.total} onAdd={(sec) => setRest((r) => ({ ...r, endAt: r.endAt + sec * 1000, total: r.total + sec }))} onStop={() => setRest(null)} />}
    </div>
  )
}

function SetRow({ n, s, onChange, onTick, onRemove }) {
  return (
    <>
      <span className={`set-n ${s.done ? 'lime' : ''}`}>{n}</span>
      <input className="text-input" type="number" inputMode="decimal" step="any" min="0" value={s.w} placeholder="–" aria-label={`Set ${n} weight`} onChange={(e) => onChange({ w: e.target.value })} />
      <input className="text-input" type="number" inputMode="numeric" min="0" value={s.reps} placeholder="0" aria-label={`Set ${n} reps`} onChange={(e) => onChange({ reps: e.target.value })} />
      <button className={`tick ${s.done ? 'on' : ''}`} onClick={onTick} aria-label={`Set ${n} done`}>✓</button>
      <button className="btn-ghost x" onClick={onRemove} aria-label={`Remove set ${n}`}>✕</button>
    </>
  )
}
