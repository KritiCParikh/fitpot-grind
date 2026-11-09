import { useEffect, useRef, useState } from 'react'

// Drafts (phase 5.12): anything you're typing in Training or Food is kept on
// this phone as you go, so closing the app (or a phone call, or a dead
// battery) never loses it. It shows in My locker → Drafts until you save it
// or discard it. Stored in localStorage, per account, on this phone only:
// it's written instantly and works offline, with no Firestore writes.
//
// A draft: { id, kind, title, sub, to, data, savedAt }
//   kind  'workout' | 'routine' | 'meal' | 'food' | 'recipe'
//   to    where to pick it up (a route with ?draft=<id>)
//   data  whatever the form needs to restore itself

const KEY = (uid) => `fitpot-drafts-${uid}`
const EVT = 'fitpot-drafts'

function readAll(uid) {
  try { return JSON.parse(localStorage.getItem(KEY(uid)) || '{}') || {} } catch { return {} }
}
function writeAll(uid, all) {
  try { localStorage.setItem(KEY(uid), JSON.stringify(all)) } catch { /* private mode or full: nothing to do */ }
  window.dispatchEvent(new Event(EVT))
}

export const getDraft = (uid, id) => (uid && id ? readAll(uid)[id] || null : null)

export function putDraft(uid, id, entry) {
  const all = readAll(uid)
  all[id] = { ...entry, id, savedAt: Date.now() }
  writeAll(uid, all)
}

export function removeDraft(uid, id) {
  if (!uid || !id) return
  const all = readAll(uid)
  if (!(id in all)) return
  delete all[id]
  writeAll(uid, all)
}

export const newDraftId = (kind) => `${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** All your drafts on this phone, newest first. Live. */
export function useDrafts(uid) {
  const [all, setAll] = useState(() => readAll(uid))
  useEffect(() => {
    const up = () => setAll(readAll(uid))
    up()
    window.addEventListener(EVT, up)
    window.addEventListener('storage', up) // another tab
    return () => { window.removeEventListener(EVT, up); window.removeEventListener('storage', up) }
  }, [uid])
  return Object.values(all).sort((a, b) => b.savedAt - a.savedAt)
}

/**
 * Keep a form saved as a draft while it has changes.
 *   id:    stable draft id for this form (see newDraftId)
 *   state: the form's values; the draft is written whenever they change from
 *          how the form opened
 *   entry: (state) => { kind, title, sub, to, data }
 * always: keep it from the moment the form opens (e.g. a food you picked).
 * Returns { dirty, kept, finish }. Call finish() after saving or discarding,
 * so the draft is removed and not written again.
 */
export function useAutoDraft(uid, id, state, entry, { always = false } = {}) {
  const json = JSON.stringify(state)
  const [start] = useState(always ? '' : json)
  const finished = useRef(false)
  const dirty = json !== start
  const kept = dirty || Boolean(getDraft(uid, id))
  useEffect(() => {
    if (finished.current || !dirty || !uid || !id) return
    putDraft(uid, id, entry(JSON.parse(json)))
  }, [uid, id, dirty, json]) // eslint-disable-line react-hooks/exhaustive-deps
  return {
    dirty,
    kept,
    finish() { finished.current = true; removeDraft(uid, id) },
  }
}

const KIND_LABEL = { workout: 'Workout', routine: 'Routine', meal: 'Meal', food: 'My food', recipe: 'Recipe' }
export const draftKindLabel = (k) => KIND_LABEL[k] || 'Draft'
