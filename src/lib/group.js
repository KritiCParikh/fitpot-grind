import {
  doc, collection, getDoc, setDoc, addDoc, updateDoc, deleteField, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { todayInTz, dayInTz, addDays, mondayOf } from './dates'

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

export async function createGroup(user, { name, penalty, weeklyTarget = 4, photoRequired = true }) {
  let code
  for (let i = 0; i < 5; i++) {
    code = randomCode()
    if (!(await getDoc(doc(db, 'passcodes', code))).exists()) break
  }
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
  const groupRef = doc(collection(db, 'groups'))
  const profile = profileOf(user)

  const batch = writeBatch(db)
  batch.set(groupRef, {
    name: name.trim() || 'FitPot Crew',
    passcode: code,
    penalty: Number(penalty) || 0,
    weeklyTarget: Math.min(7, Math.max(1, Number(weeklyTarget) || 7)),
    photoRequired: Boolean(photoRequired),
    timezone,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  })
  batch.set(doc(db, 'passcodes', code), { groupId: groupRef.id })
  batch.set(doc(db, 'groups', groupRef.id, 'members', user.uid), {
    ...profile, passcode: code, joinedAt: serverTimestamp(), joinedDate: todayInTz(timezone),
  })
  batch.set(doc(db, 'users', user.uid), { ...profile, groupId: groupRef.id }, { merge: true })
  await batch.commit()
  return groupRef.id
}

export async function joinGroup(user, rawCode) {
  const code = rawCode.trim().toUpperCase()
  const snap = await getDoc(doc(db, 'passcodes', code))
  if (!snap.exists()) throw new Error('No group with that passcode.')
  const groupId = snap.data().groupId

  // Already a member? (Reading the member doc is only allowed if you are one.)
  let already = false
  try { already = (await getDoc(doc(db, 'groups', groupId, 'members', user.uid))).exists() } catch { /* not a member */ }

  const profile = profileOf(user)
  const batch = writeBatch(db)
  if (!already) {
    // The member doc must exist before we can read the group's timezone,
    // so the join date uses this device's timezone. Fine for friends in one area.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
    batch.set(doc(db, 'groups', groupId, 'members', user.uid), {
      ...profile, passcode: code, joinedAt: serverTimestamp(), joinedDate: todayInTz(tz),
    })
  }
  batch.set(doc(db, 'users', user.uid), { ...profile, groupId }, { merge: true })
  await batch.commit()
  return groupId
}

export async function leaveGroupLocally(user) {
  // Only clears which group this account opens; membership history stays for the ledger.
  await setDoc(doc(db, 'users', user.uid), { groupId: null }, { merge: true })
}

export async function checkIn(user, group) {
  const date = todayInTz(group.timezone)
  await setDoc(doc(db, 'groups', group.id, 'checkins', `${date}_${user.uid}`), {
    uid: user.uid,
    date,
    createdAt: serverTimestamp(),
  })
}

// A check-in counts only if the SERVER time it was written falls on its date
// in the group's timezone — so changing your phone's clock can't backdate one.
export function isValidCheckin(c, timezone) {
  if (!c.createdAt) return true // our own write, still pending
  return dayInTz(c.createdAt.toDate(), timezone) === c.date
}

// The day someone joined, from the SERVER timestamp (the client-sent
// joinedDate is only a fallback while the write is pending).
export function joinDay(member, timezone) {
  return member.joinedAt ? dayInTz(member.joinedAt.toDate(), timezone) : member.joinedDate
}

// Rest day: vote (or un-vote) for TODAY. The vote is stamped with server time,
// so a vote cast after the day ended never counts.
export async function setRestVote(user, group, on) {
  const day = todayInTz(group.timezone)
  const ref = doc(db, 'groups', group.id, 'restdays', day)
  if (on) await setDoc(ref, { votes: { [user.uid]: serverTimestamp() } }, { merge: true })
  else await updateDoc(ref, { [`votes.${user.uid}`]: deleteField() })
}

// Penalty changes take effect TOMORROW, so today's stakes never change mid-day.
export async function changePenalty(user, group, amount) {
  await addDoc(collection(db, 'groups', group.id, 'penalties'), {
    penalty: Number(amount) || 0,
    effectiveDate: addDays(todayInTz(group.timezone), 1),
    setBy: user.uid,
    setAt: serverTimestamp(),
  })
}

// Undo today's check-in (and its photo record). The Drive file itself stays.
export async function undoCheckIn(user, group, { hasPhoto }) {
  const id = `${todayInTz(group.timezone)}_${user.uid}`
  const batch = writeBatch(db)
  batch.delete(doc(db, 'groups', group.id, 'checkins', id))
  if (hasPhoto) batch.delete(doc(db, 'groups', group.id, 'photos', id))
  await batch.commit()
}

// Weekly target changes start NEXT Monday, so the current week never changes.
export async function changeTarget(user, group, target) {
  await addDoc(collection(db, 'groups', group.id, 'targets'), {
    target: Math.min(7, Math.max(1, Number(target) || 7)),
    effectiveDate: addDays(mondayOf(todayInTz(group.timezone)), 7),
    setBy: user.uid,
    setAt: serverTimestamp(),
  })
}

export async function setPhotoRequired(group, required) {
  await updateDoc(doc(db, 'groups', group.id), { photoRequired: required })
}

// Groups created before this setting existed default to requiring a photo.
export const photoRequiredFor = (group) => group.photoRequired !== false
