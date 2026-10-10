import { useState } from 'react'
import { saveWorkout, deleteWorkout, saveSettings } from '../lib/privateData'
import {
  muscleLabel, lastTime, beatIt, personalRecords, units, isCardio, cardioMetric, countLabel, lastCardio, KM_PER_MI,
} from '../lib/training'
import ExercisePicker from './ExercisePicker'
import RestTimer from './RestTimer'
import UnitSwitch from './UnitSwitch'

const PR_LABEL = {
  weight: 'Heaviest weight', e1rm: 'Best estimated 1 rep max', reps: 'Most reps',
  distance: 'Longest distance', pace: 'Fastest pace', time: 'Longest session', count: 'Highest count',
}
const LB = 2.20462

// Log a workout. Strength exercises take sets of weight x reps; cardio takes
// distance and time (or time and a count, for stair climber and skipping).
// Each exercise shows last time and a target to beat. Ticking a strength set
// starts the rest timer. New personal records are shown when you save.
//
// `initial`: an existing workout to edit, or { date, title, exercises } to start from.
export default function WorkoutEditor({ uid, initial, workouts, exercises, have, u: u0, restSec = 90, today, onClose }) {
  const [wu, setWu] = useState(u0.unit)
  const [du, setDu] = useState(u0.dist)
  const u = units(wu, du)
  const [date, setDate] = useState(initial.date || today)
  const [title, setTitle] = useState(initial.title || '')
  const [notes, setNotes] = useState(initial.notes || '')
  const [items, setItems] = useState(() => (initial.exercises || []).map((ex) => toItem(ex, ex.sets, u, Boolean(initial.id))))
  const [picking, setPicking] = useState(false)
  const [rest, setRest] = useState(null) // { endAt, total }
  const [busy, setBusy] = useState(false)
  const [prs, setPrs] = useState(null)
  const others = workouts.filter((w) => w.id !== initial.id)
  const stepKg = wu === 'lb' ? 5 / LB : 2.5

  const setItem = (i, fn) => setItems((l) => l.map((x, j) => (j === i ? fn(x) : x)))
  const setSet = (i, k, patch) => setItem(i, (x) => ({ ...x, sets: x.sets.map((s, j) => (j === k ? { ...s, ...patch } : s)) }))

  // Switching units converts what's already typed, and becomes your default.
  function switchWeight(next) {
    if (next === wu) return
    const f = next === 'lb' ? LB : 1 / LB
    setItems((l) => l.map((x) => (x.cardio ? x : { ...x, sets: x.sets.map((s) => ({ ...s, w: s.w ? String(Math.round(Number(s.w) * f * 10) / 10) : '' })) })))
    setWu(next)
    saveSettings(uid, { weightUnit: next })
  }
  function switchDist(next) {
    if (next === du) return
    const f = next === 'mi' ? 1 / KM_PER_MI : KM_PER_MI
    setItems((l) => l.map((x) => (!x.cardio ? x : { ...x, sets: x.sets.map((s) => ({ ...s, d: s.d ? String(Math.round(Number(s.d) * f * 100) / 100) : '' })) })))
    setDu(next)
    saveSettings(uid, { distanceUnit: next })
  }

  function addExercise(ex) {
    setPicking(false)
    // Pre-fill from last time so it's quick to log, and easy to beat.
    if (isCardio(ex)) {
      const last = lastCardio(others, ex.key, { before: date })
      setItems((l) => [...l, toItem(ex, last ? [{ km: last.km, min: last.min, count: last.count }] : [{}], u, false)])
    } else {
      const last = lastTime(others, ex.key, { before: date })
      setItems((l) => [...l, toItem(ex, last ? last.sets : [{}], u, false)])
    }
  }

  function tick(i, k) {
    const x = items[i], s = x.sets[k]
    setSet(i, k, { done: !s.done })
    if (!x.cardio && !s.done && Number(s.reps) > 0 && restSec) setRest({ endAt: Date.now() + restSec * 1000, total: restSec })
  }

  async function save() {
    const clean = items.map((x) => (x.cardio
      ? {
        key: x.key, name: x.name, muscle: 'cardio', kind: 'cardio',
        sets: x.sets.filter((s) => Number(s.d) > 0 || Number(s.min) > 0).map((s) => ({
          km: Math.round(u.toKm(s.d) * 1000) / 1000, min: Math.round((Number(s.min) || 0) * 10) / 10, count: Math.round(Number(s.count) || 0),
        })),
      }
      : {
        key: x.key, name: x.name, muscle: x.muscle,
        sets: x.sets.filter((s) => Number(s.reps) > 0).map((s) => ({ reps: Math.round(Number(s.reps)), kg: Math.round(u.toKg(s.w) * 100) / 100 })),
      })).filter((x) => x.sets.length)
    if (!clean.length) return alert('Add at least one set with reps, or a distance or time for cardio.')
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
    const show = (p) => (p.kind === 'weight' ? u.show(p.value, p.reps)
      : p.kind === 'e1rm' ? `${u.toDisp(p.value)} ${wu}`
        : p.kind === 'reps' ? `${p.value} reps`
          : p.kind === 'distance' ? `${u.toDist(p.value)} ${du}`
            : p.kind === 'pace' ? u.showPace(p.value)
              : p.kind === 'time' ? `${p.value} min` : `${p.value}`)
    return (
      <div className="sheet">
        <div className="card pr-card">
          <p className="pr-big">New best</p>
          <h3>{prs.length} personal record{prs.length > 1 ? 's' : ''}</h3>
          <ul className="member-list">
            {prs.map((p, i) => (
              <li key={i} className="in">
                <span className="grow">{p.name}<br /><span className="muted small">{PR_LABEL[p.kind]}</span></span>
                <span className="pill">{show(p)}</span>
              </li>
            ))}
          </ul>
          <button className="btn-primary wide" onClick={onClose}>Done</button>
        </div>
      </div>
    )
  }

  if (picking) return <ExercisePicker uid={uid} exercises={exercises} have={have} onPick={addExercise} onClose={() => setPicking(false)} />

  const hasStrength = items.some((x) => !x.cardio), hasCardio = items.some((x) => x.cardio)
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
      {(hasStrength || hasCardio) && (
        <div className="unit-row">
          {hasStrength && <UnitSwitch label="Weight" value={wu} options={['kg', 'lb']} onChange={switchWeight} />}
          {hasCardio && <UnitSwitch label="Distance" value={du} options={['km', 'mi']} onChange={switchDist} />}
        </div>
      )}

      {items.map((x, i) => (x.cardio
        ? <CardioCard key={i} x={x} u={u} others={others} date={date}
          onSet={(k, patch) => setSet(i, k, patch)} onTick={(k) => tick(i, k)}
          onRemoveSet={(k) => setItem(i, (y) => ({ ...y, sets: y.sets.filter((_, j) => j !== k) }))}
          onAddSet={() => setItem(i, (y) => ({ ...y, sets: [...y.sets, { d: '', min: '', count: '', done: false }] }))}
          onRemove={() => setItems((l) => l.filter((_, j) => j !== i))} />
        : <StrengthCard key={i} x={x} u={u} others={others} date={date} stepKg={stepKg}
          onSet={(k, patch) => setSet(i, k, patch)} onTick={(k) => tick(i, k)}
          onRemoveSet={(k) => setItem(i, (y) => ({ ...y, sets: y.sets.filter((_, j) => j !== k) }))}
          onAddSet={() => setItem(i, (y) => ({ ...y, sets: [...y.sets, { ...(y.sets[y.sets.length - 1] || { w: '', reps: '' }), done: false }] }))}
          onRemove={() => setItems((l) => l.filter((_, j) => j !== i))} />))}

      <button className="btn-ghost wide" onClick={() => setPicking(true)}>+ Add exercise</button>
      <label className="form notes">Notes (how it felt, form cues, anything)
        <textarea className="text-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Shoulder felt tight on the last set" />
      </label>
      <button className="btn-primary wide" onClick={save} disabled={busy || !items.length}>{busy ? 'Saving...' : 'Save workout'}</button>
      {initial.id && <button className="btn-ghost wide danger" onClick={remove}>Delete workout</button>}
      <p className="muted small">Private to you. Bodyweight exercises: leave weight empty, or enter extra weight such as a dip belt.</p>

      {rest && <RestTimer endAt={rest.endAt} total={rest.total} onAdd={(sec) => setRest((r) => ({ ...r, endAt: r.endAt + sec * 1000, total: r.total + sec }))} onStop={() => setRest(null)} />}
    </div>
  )
}

// Editor rows keep what you typed, in the units on screen.
function toItem(ex, sets, u, done) {
  const base = { key: ex.key, name: ex.name, muscle: ex.muscle }
  if (isCardio(ex)) {
    return {
      ...base, muscle: 'cardio', cardio: true, metric: cardioMetric(ex), countLabel: countLabel(ex),
      sets: (sets?.length ? sets : [{}]).map((s) => ({ d: s.km ? String(u.toDist(s.km)) : '', min: s.min ? String(s.min) : '', count: s.count ? String(s.count) : '', done })),
    }
  }
  return { ...base, sets: (sets?.length ? sets : [{}]).map((s) => ({ w: s.kg ? String(u.toDisp(s.kg)) : '', reps: s.reps ? String(s.reps) : '', done })) }
}

const shortDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

function CardHead({ x, onRemove }) {
  return (
    <div className="ex-head">
      <span className="grow-col">
        <strong>{x.name}</strong>
        <span className="muted small">{muscleLabel(x.muscle)}</span>
      </span>
      <button className="btn-ghost" aria-label={`Remove ${x.name}`} onClick={onRemove}>✕</button>
    </div>
  )
}

function StrengthCard({ x, u, others, date, stepKg, onSet, onTick, onRemoveSet, onAddSet, onRemove }) {
  const last = lastTime(others, x.key, { before: date })
  const goal = beatIt(last, { stepKg })
  return (
    <div className="card ex-card">
      <CardHead x={x} onRemove={onRemove} />
      {last
        ? <p className="muted small">Last time ({shortDate(last.date)}): {last.sets.map((s) => u.show(s.kg, s.reps)).join(', ')}{goal && <>. <span className="lime">Beat it: {u.show(goal.kg, goal.reps)}</span></>}</p>
        : <p className="muted small">First time logging this. Today sets your baseline.</p>}
      <div className="set-grid">
        <span className="muted small">Set</span><span className="muted small">{u.unit}</span><span className="muted small">Reps</span><span /><span />
        {x.sets.map((s, k) => (
          <SetRow key={k} n={k + 1} done={s.done} onTick={() => onTick(k)} onRemove={() => onRemoveSet(k)}>
            <input className="text-input" type="number" inputMode="decimal" step="any" min="0" value={s.w} placeholder="-" aria-label={`Set ${k + 1} weight`} onChange={(e) => onSet(k, { w: e.target.value })} />
            <input className="text-input" type="number" inputMode="numeric" min="0" value={s.reps} placeholder="0" aria-label={`Set ${k + 1} reps`} onChange={(e) => onSet(k, { reps: e.target.value })} />
          </SetRow>
        ))}
      </div>
      <button className="link-btn" onClick={onAddSet}>+ Add set</button>
    </div>
  )
}

function CardioCard({ x, u, others, date, onSet, onTick, onRemoveSet, onAddSet, onRemove }) {
  const last = lastCardio(others, x.key, { before: date })
  const timeOnly = x.metric === 'time'
  const totalKm = x.sets.reduce((t, s) => t + u.toKm(s.d), 0)
  const totalMin = x.sets.reduce((t, s) => t + (Number(s.min) || 0), 0)
  return (
    <div className="card ex-card">
      <CardHead x={x} onRemove={onRemove} />
      {last
        ? <p className="muted small">Last time ({shortDate(last.date)}): {u.showCardio(last, x.metric, x.countLabel)}. <span className="lime">{timeOnly ? 'Go a little longer' : 'Go a little further or faster'}.</span></p>
        : <p className="muted small">First time logging this. Today sets your baseline.</p>}
      <div className="set-grid">
        <span className="muted small">#</span>
        <span className="muted small">{timeOnly ? 'Min' : u.dist}</span>
        <span className="muted small">{timeOnly ? x.countLabel || 'Count' : 'Min'}</span><span /><span />
        {x.sets.map((s, k) => (
          <SetRow key={k} n={k + 1} done={s.done} onTick={() => onTick(k)} onRemove={() => onRemoveSet(k)}>
            {timeOnly ? (
              <>
                <input className="text-input" type="number" inputMode="decimal" step="any" min="0" value={s.min} placeholder="0" aria-label="Minutes" onChange={(e) => onSet(k, { min: e.target.value })} />
                <input className="text-input" type="number" inputMode="numeric" min="0" value={s.count} placeholder="-" aria-label={x.countLabel || 'Count'} onChange={(e) => onSet(k, { count: e.target.value })} />
              </>
            ) : (
              <>
                <input className="text-input" type="number" inputMode="decimal" step="any" min="0" value={s.d} placeholder="0" aria-label={`Distance in ${u.dist}`} onChange={(e) => onSet(k, { d: e.target.value })} />
                <input className="text-input" type="number" inputMode="decimal" step="any" min="0" value={s.min} placeholder="0" aria-label="Minutes" onChange={(e) => onSet(k, { min: e.target.value })} />
              </>
            )}
          </SetRow>
        ))}
      </div>
      {!timeOnly && totalKm > 0 && totalMin > 0 && <p className="muted small">Pace {u.showPace(totalMin / totalKm)}</p>}
      <button className="link-btn" onClick={onAddSet}>+ Add interval</button>
    </div>
  )
}

function SetRow({ n, done, onTick, onRemove, children }) {
  return (
    <>
      <span className={`set-n ${done ? 'lime' : ''}`}>{n}</span>
      {children}
      <button className={`tick ${done ? 'on' : ''}`} onClick={onTick} aria-label={`Set ${n} done`}>✓</button>
      <button className="btn-ghost x" onClick={onRemove} aria-label={`Remove set ${n}`}>✕</button>
    </>
  )
}
