import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveRoutine, useRoutines } from '../lib/privateData'
import { isCardio } from '../lib/training'
import { sendRoutine, routineLink } from '../lib/chat'
import { useUserDoc, useGroupsMeta } from '../hooks'

// Routine sharing (phase 5.15): a routine travels with who curated it.
// The friend can Add to my locker (saved in their Routines, "Curated by Ved")
// or Try it now (a one-time workout from it, saved to their Log when they finish).

const TRY_KEY = 'fitpot-try'
/** Open a shared routine as a one-time workout. */
export function tryRoutine(navigate, routine) {
  try { sessionStorage.setItem(TRY_KEY, JSON.stringify(routine)) } catch { /* private mode */ }
  navigate('/locker?me=training&t=log&try=1')
}
/** Read (and clear) a routine waiting to be tried. */
export function takeTryRoutine() {
  try { const v = sessionStorage.getItem(TRY_KEY); sessionStorage.removeItem(TRY_KEY); return v ? JSON.parse(v) : null } catch { return null }
}

const line = (it) => (isCardio(it) ? `${it.name}${it.min ? ` ${it.min} min` : ''}` : `${it.name}${it.sets && it.reps ? ` ${it.sets}×${it.reps}` : it.sets ? ` ${it.sets} sets` : ''}`)

/** A shared routine, in chat or from a link. */
export function RoutineCard({ user, routine, standalone = false }) {
  const navigate = useNavigate()
  const mine = useRoutines(user.uid)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!routine) return null
  const fromMe = routine.curatedBy === user.uid
  const already = saved || (mine || []).some((r) => r.name === routine.name && r.curatedBy === routine.curatedBy && r.items?.length === routine.items?.length)
  async function add() {
    setBusy(true)
    try {
      await saveRoutine(user.uid, { name: routine.name, items: routine.items, autoFill: routine.autoFill !== false, curatedBy: routine.curatedBy || '', curatedByName: routine.curatedByName || '' })
      setSaved(true)
    } finally { setBusy(false) }
  }
  return (
    <div className={`routine-card ${standalone ? 'card' : ''}`}>
      <p className="invite-title">Routine</p>
      <p className="routine-name"><strong>{routine.name}</strong></p>
      {routine.curatedByName && <p className="muted small curated">Curated by {fromMe ? 'you' : routine.curatedByName}</p>}
      <ul className="routine-lines">
        {(routine.items || []).slice(0, 8).map((it, i) => <li key={i}>{line(it)}</li>)}
        {(routine.items || []).length > 8 && <li className="muted small">and {routine.items.length - 8} more</li>}
      </ul>
      <div className="action-row">
        {fromMe
          ? <span className="muted small">Shared by you</span>
          : <button type="button" className="btn-primary" disabled={busy || already} onClick={add}>{already ? 'In your locker' : 'Add to my locker'}</button>}
        <button type="button" className="btn-ghost" onClick={() => tryRoutine(navigate, routine)}>Try it now</button>
      </div>
      {already && !fromMe && <p className="muted small">Find it in Training, Routines.</p>}
    </div>
  )
}

/** Share one of your routines: into a crew chat, or as a link to send anywhere. */
export function RoutineShareSheet({ user, routine, onClose }) {
  const profile = useUserDoc(user.uid)
  const ids = [...new Set([...(profile?.groupIds || []), profile?.groupId].filter(Boolean))].filter((id) => !(profile?.leftGroupIds || []).includes(id))
  const meta = useGroupsMeta(ids)
  const [done, setDone] = useState({})
  const [msg, setMsg] = useState('')
  async function post(gid) {
    try { await sendRoutine(user, gid, routine); setDone((d) => ({ ...d, [gid]: true })) } catch (e) { setMsg(e.message || String(e)) }
  }
  async function link() {
    const url = routineLink(user, routine)
    const text = `${routine.name}, a FitPot routine${routine.curatedByName && routine.curatedBy !== user.uid ? ` curated by ${routine.curatedByName}` : ''}. Add it to your locker or try it once:`
    if (navigator.share) { try { await navigator.share({ title: routine.name, text, url }); return } catch (e) { if (e.name === 'AbortError') return } }
    try { await navigator.clipboard.writeText(`${text} ${url}`); setMsg('Link copied. Paste it in WhatsApp or anywhere.') } catch { setMsg(url) }
  }
  return (
    <div className="sheet">
      <div className="sheet-head">
        <h3>Share "{routine.name}"</h3>
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>
      <p className="muted small">Friends see "Curated by {routine.curatedByName && routine.curatedBy !== user.uid ? routine.curatedByName : (user.displayName || 'you').split(' ')[0]}" and can add it to their locker or try it once. Your weights and history stay private.</p>
      {ids.length > 0 && <h3 className="section-title">To a crew chat</h3>}
      <ul className="member-list">
        {ids.map((id) => (
          <li key={id}>
            <span className="grow">{meta[id]?.name || '...'}</span>
            <button type="button" className={done[id] ? 'btn-ghost' : 'btn-primary'} disabled={done[id]} onClick={() => post(id)}>{done[id] ? 'Shared' : 'Share'}</button>
          </li>
        ))}
      </ul>
      <h3 className="section-title">Anywhere else</h3>
      <button type="button" className="btn-ghost wide" onClick={link}>Share a link</button>
      {msg && <p className="muted small" role="status">{msg}</p>}
    </div>
  )
}
