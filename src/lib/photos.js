import { doc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { dayInTz, todayInTz } from './dates'

export const DRIVE_URL = import.meta.env.VITE_DRIVE_UPLOAD_URL || ''
export const photosEnabled = Boolean(DRIVE_URL)

// Apps Script web apps accept a "simple" POST (text/plain), which avoids a
// CORS preflight. The body is still JSON.
async function callDrive(payload) {
  const res = await fetch(DRIVE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Photo service error')
  return data
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// Upload to Drive, then record the photo — and, when `checkIn` is true, the
// check-in too, in one batch (the rules require the photo when the group does).
export async function uploadPhoto(user, group, blob, { checkIn = false } = {}) {
  const idToken = await user.getIdToken()
  const res = await callDrive({ action: 'upload', idToken, groupId: group.id, imageBase64: await blobToBase64(blob) })
  const day = todayInTz(group.timezone)
  const id = `${day}_${user.uid}`
  const batch = writeBatch(db)
  batch.set(doc(db, 'groups', group.id, 'photos', id), {
    uid: user.uid, date: day, fileId: res.fileId, createdAt: serverTimestamp(),
  })
  if (checkIn) {
    batch.set(doc(db, 'groups', group.id, 'checkins', id), {
      uid: user.uid, date: day, createdAt: serverTimestamp(),
    })
  }
  await batch.commit()
  return res
}

export const isValidPhoto = (p, tz) => !p.createdAt || dayInTz(p.createdAt.toDate(), tz) === p.date

// Photos are private in Drive, so they're fetched through the script and
// cached on the phone (Cache Storage) so each one downloads only once.
const memory = new Map()
const CACHE = 'fitpot-photos-v1'

export async function photoUrl(user, group, fileId) {
  if (memory.has(fileId)) return memory.get(fileId)
  const key = `https://fitpot.local/photo/${fileId}`
  let blob
  try {
    const cache = await caches.open(CACHE)
    const hit = await cache.match(key)
    if (hit) blob = await hit.blob()
  } catch { /* Cache Storage unavailable (private mode) — just refetch */ }

  if (!blob) {
    const idToken = await user.getIdToken()
    const res = await callDrive({ action: 'get', idToken, groupId: group.id, fileId })
    blob = await (await fetch(`data:${res.mime};base64,${res.data}`)).blob()
    try { await (await caches.open(CACHE)).put(key, new Response(blob)) } catch { /* ignore */ }
  }
  const url = URL.createObjectURL(blob)
  memory.set(fileId, url)
  return url
}
