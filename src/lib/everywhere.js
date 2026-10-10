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

import { doc, collection, getDoc, getDocs, query, where, addDoc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { makeClock, localTz } from './clock'
import { addDays } from './dates'
import { photosEnabled, uploadToDrive } from './photos'

const needsPhoto = (g) => g.photoRequired !== false

/** Your situation in each group today: [{ id, name, date, needsPhoto, checkedIn, hasPhoto }] */
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
      const [c, p] = await Promise.all([
        getDoc(doc(db, 'groups', id, 'checkins', key)),
        getDoc(doc(db, 'groups', id, 'photos', key)),
      ])
      out.push({ id, name: g.name, date, key, needsPhoto: needsPhoto(g), checkedIn: c.exists(), hasPhoto: p.exists() })
    } catch { /* can't read that group (e.g. removed): skip it */ }
  }
  return out
}

/**
 * Check in everywhere. With `blob` (a camera photo) every group gets the photo
 * and the check-in. Without it, only groups that don't require a photo are
 * checked in. With `photoOnly`, the photo is added where you're already in.
 * Returns { done: [names], skipped: [{ name, reason }] }.
 */
export async function checkInEverywhere(user, groupIds, { blob = null, photoOnly = false } = {}) {
  const groups = await myDayInGroups(user, groupIds)
  const done = [], skipped = []
  for (const g of groups) {
    const wantCheckin = !photoOnly && !g.checkedIn
    const wantPhoto = blob && photosEnabled && !g.hasPhoto && (wantCheckin || g.checkedIn)
    if (wantCheckin && g.needsPhoto && !wantPhoto) {
      skipped.push({ name: g.name, reason: blob ? 'photos aren\'t set up' : 'needs a photo' })
      continue
    }
    if (!wantCheckin && !wantPhoto) continue
    try {
      const batch = writeBatch(db)
      if (wantPhoto) {
        const { fileId } = await uploadToDrive(user, g.id, blob)
        batch.set(doc(db, 'groups', g.id, 'photos', g.key), { uid: user.uid, date: g.date, fileId, createdAt: serverTimestamp() })
      }
      if (wantCheckin) batch.set(doc(db, 'groups', g.id, 'checkins', g.key), { uid: user.uid, date: g.date, createdAt: serverTimestamp() })
      await batch.commit()
      done.push(g.name)
    } catch (e) {
      skipped.push({ name: g.name, reason: e.message || 'failed' })
    }
  }
  return { done, skipped }
}

/** Undo today's check-in (and photo) in every group. Drive files stay. */
export async function undoEverywhere(user, groupIds) {
  const groups = await myDayInGroups(user, groupIds)
  for (const g of groups) {
    if (!g.checkedIn && !g.hasPhoto) continue
    const batch = writeBatch(db)
    if (g.checkedIn) batch.delete(doc(db, 'groups', g.id, 'checkins', g.key))
    if (g.hasPhoto) batch.delete(doc(db, 'groups', g.id, 'photos', g.key))
    await batch.commit().catch(() => {}) // older than 24 h or already gone
  }
}
