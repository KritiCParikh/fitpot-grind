// One check-in for all your groups (phase 5.2).
//
// You take ONE workout photo (or tap CHECK IN once) and it counts in every
// group you're still in. For each group FitPot works out your day there (your
// timezone as that group knows it), skips groups where you're already in for
// the day, and writes that group's photo + check-in in its own batch, so one
// group failing never blocks the others.
//
// Each group gets its own copy of the photo in Drive: the Drive script only
// serves a photo to members of the group it was uploaded for, which keeps
// groups private from each other.
//
// Up to 4 photos a day (phase 5.6). Photo docs use slots:
//   <date>_<uid>     slot 1 (a check-in needs this one, see firestore.rules)
//   <date>_<uid>_2   slot 2, then _3 and _4
// Copies of the same camera shot in different groups share a `shot` id, so
// deleting one photo removes it from every group.
//
// Sessions (phase 5.13): worked out more than once today (morning gym,
// evening run, tennis at night)? The check-in is session 1 and stores its part
// of the day. Up to 3 more sessions are docs in groups/{gid}/sessions:
//   <date>_<uid>_2, _3, _4   { uid, date, n, part, activity?, createdAt }
// each with an optional photo in the matching photo slot. Extra sessions are a
// +1 / +2 / +3 boost for fun: the pot and weekly target still count one day.

import { doc, collection, getDoc, getDocs, query, where, addDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { makeClock, localTz } from './clock'
import { addDays } from './dates'
import { photosEnabled, uploadToDrive } from './photos'

const needsPhoto = (g) => g.photoRequired !== false

export const MAX_PHOTOS = 4
export const MAX_SESSIONS = 4
export const ACTIVITIES = ['Gym', 'Run', 'Tennis', 'Swim', 'Yoga', 'Cycle', 'Sport', 'Other']
export const PARTS = ['Morning', 'Afternoon', 'Evening', 'Night']
/** Part of the day for a time on this phone: 4 am to noon morning, to 5 pm afternoon, to 9 pm evening, then night. */
export function partOfDay(date = new Date()) {
  const h = date.getHours()
  return h >= 4 && h < 12 ? 'Morning' : h >= 12 && h < 17 ? 'Afternoon' : h >= 17 && h < 21 ? 'Evening' : 'Night'
}
/** Doc id for photo slot n (1 to 4). */
export const slotId = (key, n) => (n === 1 ? key : `${key}_${n}`)
const newShotId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('')

/** Your situation in each group today: [{ id, name, date, key, needsPhoto, checkedIn, slots: [1..4 used] }] */
export async function myDayInGroups(user, groupIds) {
  const out = []
  for (const id of groupIds) {
    try {
      const [gSnap, mSnap] = await Promise.all([
        getDoc(doc(db, 'groups', id)),
        getDoc(doc(db, 'groups', id, 'members', user.uid)),
      ])
      if (!gSnap.exists() || !mSnap.exists() || mSnap.data().leftAt) continue
      const g = gSnap.data()
      const tz = await getDocs(query(collection(db, 'groups', id, 'tzchanges'), where('uid', '==', user.uid)))
      const tzChanges = tz.docs.map((d) => d.data())
      const clock = makeClock({ groupTz: g.timezone, members: [{ uid: user.uid, ...mSnap.data() }], tzChanges, myUid: user.uid })
      // Your phone moved timezone and this group doesn't know yet: tell it (from your next day).
      const phone = localTz()
      if (clock.finalTz() !== phone) {
        await addDoc(collection(db, 'groups', id, 'tzchanges'), {
          uid: user.uid, timezone: phone, effectiveDate: addDays(clock.today(), 1), setAt: serverTimestamp(),
        }).catch(() => {})
      }
      const date = clock.today()
      const key = `${date}_${user.uid}`
      const [c, ...rest] = await Promise.all([
        getDoc(doc(db, 'groups', id, 'checkins', key)),
        ...[1, 2, 3, 4].map((n) => getDoc(doc(db, 'groups', id, 'photos', slotId(key, n)))),
        ...[2, 3, 4].map((n) => getDoc(doc(db, 'groups', id, 'sessions', slotId(key, n))).catch(() => null)),
      ])
      const slots = [1, 2, 3, 4].filter((n, i) => rest[i].exists())
      const sessions = [2, 3, 4].filter((n, i) => rest[4 + i]?.exists())
      out.push({ id, name: g.name, date, key, needsPhoto: needsPhoto(g), checkedIn: c.exists(), slots, sessions, hasPhoto: slots.length > 0 })
    } catch { /* can't read that group (e.g. removed): skip it */ }
  }
  return out
}

/**
 * Check in everywhere. With `blob` (a camera photo) every group gets the photo
 * (in its next free slot) and the check-in. Without it, only groups that don't
 * require a photo are checked in. With `photoOnly`, the photo is added where
 * you're already in. `activity` is an optional tag like 'Tennis'.
 * Returns { done: [names], skipped: [{ name, reason }] }.
 */
export async function checkInEverywhere(user, groupIds, { blob = null, photoOnly = false, activity = '', part = partOfDay() } = {}) {
  const groups = await myDayInGroups(user, groupIds)
  const done = [], skipped = []
  const shot = newShotId()
  for (const g of groups) {
    const wantCheckin = !photoOnly && !g.checkedIn
    const plan = photoPlan(g, { blob: Boolean(blob) && photosEnabled, wantCheckin })
    if (plan.skip) { skipped.push({ name: g.name, reason: plan.skip }); continue }
    const { slot } = plan
    const wantPhoto = slot > 0
    if (!wantCheckin && !wantPhoto) continue
    try {
      const batch = writeBatch(db)
      if (wantPhoto) {
        const { fileId } = await uploadToDrive(user, g.id, blob)
        batch.set(doc(db, 'groups', g.id, 'photos', slotId(g.key, slot)), {
          uid: user.uid, date: g.date, fileId, createdAt: serverTimestamp(), shot, slot,
          ...(activity ? { activity } : {}),
        })
      }
      if (wantCheckin) batch.set(doc(db, 'groups', g.id, 'checkins', g.key), { uid: user.uid, date: g.date, createdAt: serverTimestamp(), part, ...(activity ? { activity } : {}) })
      await batch.commit()
      done.push(g.name)
    } catch (e) {
      skipped.push({ name: g.name, reason: e.message || 'failed' })
    }
  }
  return { done, skipped }
}

/**
 * Add another session today (phase 5.13), in every group you've checked in
 * to: part of the day, an optional activity and an optional photo. Each group
 * gets the next free number (2 to 4) and, with a photo, that photo slot.
 * Returns { done: [names], skipped: [{ name, reason }] }.
 */
export async function addSessionEverywhere(user, groupIds, { part = partOfDay(), activity = '', blob = null } = {}) {
  const groups = await myDayInGroups(user, groupIds)
  const done = [], skipped = []
  const shot = newShotId()
  for (const g of groups) {
    if (!g.checkedIn) { skipped.push({ name: g.name, reason: 'check in first' }); continue }
    const n = sessionPlan(g, { photo: Boolean(blob) && photosEnabled })
    if (!n) { skipped.push({ name: g.name, reason: `already ${MAX_SESSIONS} sessions today` }); continue }
    try {
      const batch = writeBatch(db)
      batch.set(doc(db, 'groups', g.id, 'sessions', slotId(g.key, n)), {
        uid: user.uid, date: g.date, n, part, createdAt: serverTimestamp(), ...(activity ? { activity } : {}), ...(blob ? { shot } : {}),
      })
      if (blob && photosEnabled) {
        const { fileId } = await uploadToDrive(user, g.id, blob)
        batch.set(doc(db, 'groups', g.id, 'photos', slotId(g.key, n)), {
          uid: user.uid, date: g.date, fileId, createdAt: serverTimestamp(), shot, slot: n, ...(activity ? { activity } : {}),
        })
      }
      await batch.commit()
      done.push(g.name)
    } catch (e) {
      skipped.push({ name: g.name, reason: e.message || 'failed' })
    }
  }
  return { done, skipped }
}

/** Next session number (2 to 4) in one group, or 0 when full (pure). With a photo, its slot must be free too. */
export function sessionPlan(g, { photo }) {
  return [2, 3, 4].find((n) => !g.sessions.includes(n) && (!photo || !g.slots.includes(n))) || 0
}

/**
 * Where a new photo goes in one group (pure, so it's testable).
 * g: { checkedIn, needsPhoto, slots }. Returns { slot } (0 = no photo) or { skip: reason }.
 */
export function photoPlan(g, { blob, wantCheckin }) {
  const free = [1, 2, 3, 4].filter((n) => !g.slots.includes(n))
  const canPost = blob && (wantCheckin || g.checkedIn)
  // A check-in needs slot 1; if slot 1 is already there, the new photo takes the next free slot.
  const slot = !canPost ? 0 : wantCheckin && !g.slots.includes(1) ? 1 : free[0] || 0
  if (canPost && !slot) return { skip: `already ${MAX_PHOTOS} photos today` }
  if (wantCheckin && g.needsPhoto && !slot && !g.slots.includes(1)) return { skip: 'needs a photo' }
  return { slot }
}

/** Undo today's check-in, sessions and photos in every group. Drive files stay. */
export async function undoEverywhere(user, groupIds) {
  const groups = await myDayInGroups(user, groupIds)
  for (const g of groups) {
    if (!g.checkedIn && !g.hasPhoto && !g.sessions.length) continue
    const batch = writeBatch(db)
    if (g.checkedIn) batch.delete(doc(db, 'groups', g.id, 'checkins', g.key))
    for (const n of g.slots) batch.delete(doc(db, 'groups', g.id, 'photos', slotId(g.key, n)))
    for (const n of g.sessions) batch.delete(doc(db, 'groups', g.id, 'sessions', slotId(g.key, n)))
    await batch.commit().catch(() => {}) // older than 24 h or already gone
  }
}

/**
 * Delete one photo (not the check-in), from every group it was posted to.
 * Older photos without a shot id are deleted from the group shown only.
 */
export async function deletePhotoEverywhere(user, groupIds, photo, currentGroupId) {
  if (!photo.shot) {
    await deleteDoc(doc(db, 'groups', currentGroupId, 'photos', photo.id))
    return
  }
  for (const id of groupIds) {
    try {
      const snap = await getDocs(query(collection(db, 'groups', id, 'photos'), where('shot', '==', photo.shot)))
      for (const d of snap.docs) if (d.data().uid === user.uid) await deleteDoc(d.ref)
    } catch { /* not readable or already gone */ }
  }
}
