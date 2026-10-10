import {
  doc, collection, getDoc, setDoc, addDoc, updateDoc, deleteField, writeBatch, serverTimestamp,
  arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from '../firebase'
import { todayInTz, dayInTz, addDays, mondayOf } from './dates'
import { localTz } from './clock'
import { CODES, MAX_PENALTY } from './money'

// No 0/O/1/I/L so codes are easy to read out loud.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function randomCode(len = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

function profileOf(user) {
  return {
    name: user.displayName || user.email?.split('@')[0] || 'Friend',
    photoURL: user.photoURL || '',
  }
}

export async function createGroup(user, { name, penalty, weeklyTarget = 4, photoRequired = true, currency = 'USD' }) {
  let code
  for (let i = 0; i < 5; i++) {
    code = randomCode()
    if (!(await getDoc(doc(db, 'passcodes', code))).exists()) break
  }
  // The group's timezone is only a fallback now: each member has their own.
  const timezone = localTz()
  const groupRef = doc(collection(db, 'groups'))
  const profile = profileOf(user)

  const batch = writeBatch(db)
  batch.set(groupRef, {
    name: name.trim() || 'FitPot Crew',
    passcode: code,
    penalty: Math.min(MAX_PENALTY, Math.max(0, Number(penalty) || 0)),
    currency: CODES.includes(currency) ? currency : 'USD',
    weeklyTarget: Math.min(7, Math.max(1, Number(weeklyTarget) || 7)),
    photoRequired: Boolean(photoRequired),
    timezone,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  })
  batch.set(doc(db, 'passcodes', code), { groupId: groupRef.id })
  batch.set(doc(db, 'groups', groupRef.id, 'members', user.uid), {
    ...profile, passcode: code, timezone, joinedAt: serverTimestamp(), joinedDate: todayInTz(timezone),
  })
  // You can be in several groups; groupId is the one you're looking at.
  batch.set(doc(db, 'users', user.uid), { ...profile, groupId: groupRef.id, groupIds: arrayUnion(groupRef.id) }, { merge: true })
  await batch.commit()
  return groupRef.id
}

export async function joinGroup(user, rawCode) {
  const code = rawCode.trim().toUpperCase()
  const snap = await getDoc(doc(db, 'passcodes', code))
  if (!snap.exists()) throw new Error('No group with that passcode.')
  const groupId = snap.data().groupId

  // Already a member? (Reading the member doc is only allowed if you are one.)
  let already = false, left = null
  try {
    const me = await getDoc(doc(db, 'groups', groupId, 'members', user.uid))
    already = me.exists()
    left = me.data()?.leftAt || null
  } catch { /* not a member */ }
  if (left) throw new Error(`You left this group on ${left.toDate().toLocaleDateString()}. Rejoining a group you left isn't supported yet.`)

  const profile = profileOf(user)
  const batch = writeBatch(db)
  if (!already) {
    // Your day follows your own phone's timezone, saved when you join.
    const tz = localTz()
    batch.set(doc(db, 'groups', groupId, 'members', user.uid), {
      ...profile, passcode: code, timezone: tz, joinedAt: serverTimestamp(), joinedDate: todayInTz(tz),
    })
  }
  batch.set(doc(db, 'users', user.uid), { ...profile, groupId, groupIds: arrayUnion(groupId) }, { merge: true })
  await batch.commit()
  return groupId
}

// Which of your groups the Today / Calendar / Wall / Board tabs show.
export async function setActiveGroup(user, groupId) {
  await setDoc(doc(db, 'users', user.uid), { groupId, ...(groupId ? { groupIds: arrayUnion(groupId) } : {}) }, { merge: true })
}

// Leave a group for good. You stop counting from your NEXT day (today still
// counts; in weekly groups, a week you've started still counts). Your past
// results stay in the group's ledger. Rejoining isn't supported yet.
export async function leaveGroup(user, group, otherIds = []) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'groups', group.id, 'members', user.uid), { leftAt: serverTimestamp() })
  batch.set(doc(db, 'users', user.uid), {
    groupIds: arrayRemove(group.id),
    leftGroupIds: arrayUnion(group.id), // remembered so "Delete my account" can anonymise you there too
    groupId: otherIds.find((id) => id !== group.id) || null,
  }, { merge: true })
  await batch.commit()
}

export async function checkIn(user, group) {
  const date = group.clock.today()
  await setDoc(doc(db, 'groups', group.id, 'checkins', `${date}_${user.uid}`), {
    uid: user.uid,
    date,
    createdAt: serverTimestamp(),
  })
}

// The day someone joined, from the SERVER timestamp, in their own timezone
// (the client-sent joinedDate is only a fallback while the write is pending).
// Validity of check-ins and photos lives in clock.js (onItsDay).
export function joinDay(member, groupTimezone) {
  return member.joinedAt ? dayInTz(member.joinedAt.toDate(), member.timezone || groupTimezone) : member.joinedDate
}

// Rest day: vote (or un-vote) for YOUR today. The vote is stamped with server
// time, so a vote cast after your day ended never counts.
export async function setRestVote(user, group, on) {
  const day = group.clock.today()
  const ref = doc(db, 'groups', group.id, 'restdays', day)
  if (on) await setDoc(ref, { votes: { [user.uid]: serverTimestamp() } }, { merge: true })
  else await updateDoc(ref, { [`votes.${user.uid}`]: deleteField() })
}

// Group setting changes start from the day AFTER the furthest-ahead member's
// today, so a day already underway for anyone never changes mid-day.
export const nextDay = (group) => addDays(group.clock.latestDay(), 1)

// Penalty changes take effect tomorrow, so today's stakes never change mid-day.
export async function changePenalty(user, group, amount) {
  await addDoc(collection(db, 'groups', group.id, 'penalties'), {
    penalty: Math.min(MAX_PENALTY, Math.max(0, Number(amount) || 0)),
    effectiveDate: nextDay(group),
    setBy: user.uid,
    setAt: serverTimestamp(),
  })
}

// Undo today's check-in (and its photo record). The Drive file itself stays.
export async function undoCheckIn(user, group, { hasPhoto }) {
  const id = `${group.clock.today()}_${user.uid}`
  const batch = writeBatch(db)
  batch.delete(doc(db, 'groups', group.id, 'checkins', id))
  if (hasPhoto) batch.delete(doc(db, 'groups', group.id, 'photos', id))
  await batch.commit()
}

// Weekly target changes start NEXT Monday, so the current week never changes.
export async function changeTarget(user, group, target) {
  await addDoc(collection(db, 'groups', group.id, 'targets'), {
    target: Math.min(7, Math.max(1, Number(target) || 7)),
    effectiveDate: addDays(mondayOf(group.clock.latestDay()), 7),
    setBy: user.uid,
    setAt: serverTimestamp(),
  })
}

export async function setPhotoRequired(group, required) {
  await updateDoc(doc(db, 'groups', group.id), { photoRequired: required })
}

// Groups created before this setting existed default to requiring a photo.
export const photoRequiredFor = (group) => group.photoRequired !== false

// Your phone's timezone changed (travel, moving): log it. It applies from
// YOUR next day, so the day you're in can't be stretched or shortened.
export async function logTimezoneChange(user, group, timezone) {
  await addDoc(collection(db, 'groups', group.id, 'tzchanges'), {
    uid: user.uid,
    timezone,
    effectiveDate: addDays(group.clock.today(), 1),
    setAt: serverTimestamp(),
  })
}

// Switch the pot's currency from tomorrow. `rate` = 1 old unit in the new
// currency (today's rate); all past amounts are shown converted at it. The new
// penalty (in the new currency) is logged in the same batch, same day.
export async function changeCurrency(user, group, { from, currency, rate, penalty }) {
  const effectiveDate = nextDay(group)
  const batch = writeBatch(db)
  batch.set(doc(collection(db, 'groups', group.id, 'currencies')), {
    from, currency, rate: Number(rate), penalty: Number(penalty) || 0,
    effectiveDate, setBy: user.uid, setAt: serverTimestamp(),
  })
  batch.set(doc(collection(db, 'groups', group.id, 'penalties')), {
    penalty: Math.min(MAX_PENALTY, Math.max(0, Number(penalty) || 0)),
    effectiveDate, setBy: user.uid, setAt: serverTimestamp(),
  })
  await batch.commit()
}
