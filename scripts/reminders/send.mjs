// FitPot reminders: run every hour by .github/workflows/reminders.yml.
//
// For everyone who turned reminders on: work out their local time, see if a
// reminder slot is due (morning, afternoon, evening), look at their day
// (checked in? rest day? in a group?), pick a kind message and send it to
// each of their phones through Firebase Cloud Messaging.
//
// Needs the FIREBASE_SERVICE_ACCOUNT secret (a service account key, JSON).
// It reads and writes Firestore as an admin, so it never goes in the app.

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { dueSlot, messageKind, dayIndex, localNow, chatQuiet, chatPreview } from './plan.mjs'
import { pickMessage } from './messages.mjs'

const raw = process.env.FIREBASE_SERVICE_ACCOUNT
if (!raw) { console.log('FIREBASE_SERVICE_ACCOUNT is not set. Nothing to do.'); process.exit(0) }
initializeApp({ credential: cert(JSON.parse(raw)) })
const db = getFirestore()
const messaging = getMessaging()
const APP_URL = process.env.APP_URL || '/'
const now = new Date()
const DRY = process.env.DRY_RUN === '1'

const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

// Today for this person in their first active group (the one they view first).
async function dayFor(uid, date) {
  const user = (await db.doc(`users/${uid}`).get()).data() || {}
  const ids = [...new Set([user.groupId, ...(user.groupIds || [])].filter(Boolean))]
  let first = null, checkedIn = false, rest = false
  for (const gid of ids) {
    const me = await db.doc(`groups/${gid}/members/${uid}`).get()
    if (!me.exists || me.data().leftAt) continue
    if (!first) first = gid
    if ((await db.doc(`groups/${gid}/checkins/${date}_${uid}`).get()).exists) checkedIn = true
    const rd = (await db.doc(`groups/${gid}/restdays/${date}`).get()).data()
    if (rd?.votes?.[uid]) rest = true
  }
  if (!first) return { inGroup: false, name: (user.name || '').split(' ')[0] }
  const [members, today, mine] = await Promise.all([
    db.collection(`groups/${first}/members`).get(),
    db.collection(`groups/${first}/checkins`).where('date', '==', date).get(),
    db.collection(`groups/${first}/checkins`).where('uid', '==', uid).get(),
  ])
  const groupSize = members.docs.filter((d) => !d.data().leftAt).length
  const days = new Set(mine.docs.map((d) => d.data().date))
  let streak = 0, d = days.has(date) ? date : addDays(date, -1)
  while (days.has(d)) { streak++; d = addDays(d, -1) }
  return { inGroup: true, checkedIn, rest, inToday: today.size, groupSize, streak, name: (user.name || '').split(' ')[0] }
}

const devices = await db.collectionGroup('devices').get()
const byUid = {}
for (const d of devices.docs) {
  const uid = d.ref.parent.parent?.id
  if (uid && d.data().token) (byUid[uid] ||= []).push(d)
}

let sent = 0, skipped = 0, removed = 0
for (const [uid, devs] of Object.entries(byUid)) {
  try {
    const ref = db.doc(`private/${uid}/settings/reminders`)
    const settings = (await ref.get()).data()
    const slot = dueSlot(settings, now)
    if (!slot) continue
    const day = await dayFor(uid, slot.date)
    const kind = messageKind(slot.key, day)
    if (!DRY) await ref.set({ lastSent: { [slot.key]: slot.date }, lastRun: FieldValue.serverTimestamp() }, { merge: true })
    if (!kind) { skipped++; continue }
    const msg = pickMessage(kind, { dayIndex: dayIndex(slot.date), name: day.name || 'there', inToday: day.inToday, groupSize: day.groupSize, streak: day.streak })
    const url = kind === 'solo' ? `${APP_URL}#/?me=training` : `${APP_URL}#/today`
    if (DRY) { console.log(uid, slot, kind, msg); continue }
    const res = await messaging.sendEach(devs.map((d) => ({
      token: d.data().token,
      data: { title: msg.title, body: msg.body, url, tag: `fitpot-${slot.key}` },
      webpush: { headers: { Urgency: 'normal', TTL: String(4 * 3600) } },
    })))
    res.responses.forEach((r, i) => {
      if (r.success) { sent++; return }
      const code = r.error?.code || ''
      if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
        devs[i].ref.delete().catch(() => {}); removed++ // phone uninstalled or turned notifications off
      } else console.warn('send failed', uid, code)
    })
  } catch (e) {
    console.warn('skipped a user after an error:', e.message)
  }
}
// Crew chat (phase 5.16): a gentle note when your crew wrote, at most once an
// hour (this job's pace), never 10 pm to 7 am your time. Your own messages
// never notify you. Turn it off in Account, Reminders.
let chatSent = 0
for (const [uid, devs] of Object.entries(byUid)) {
  try {
    const ref = db.doc(`private/${uid}/settings/reminders`)
    const settings = (await ref.get()).data()
    if (!settings?.on || settings.chat === false || !settings.tz) continue
    if (chatQuiet(localNow(now, settings.tz).minutes)) continue // waits for the morning, nothing lost
    const since = Number(settings.lastChatMs) || now.getTime() - 60 * 60000
    const user = (await db.doc(`users/${uid}`).get()).data() || {}
    const ids = [...new Set([user.groupId, ...(user.groupIds || [])].filter(Boolean))]
    for (const gid of ids) {
      const me = await db.doc(`groups/${gid}/members/${uid}`).get()
      if (!me.exists || me.data().leftAt) continue
      const snap = await db.collection(`groups/${gid}/chat`).where('createdAt', '>', Timestamp.fromMillis(since)).orderBy('createdAt', 'desc').limit(20).get()
      const msgs = snap.docs.map((d) => d.data()).filter((m) => m.uid !== uid)
      if (!msgs.length) continue
      const group = (await db.doc(`groups/${gid}`).get()).data() || {}
      const body = chatPreview(msgs[0], uid) + (msgs.length > 1 ? ` (+${msgs.length - 1} more)` : '')
      if (DRY) { console.log('chat', uid, gid, body); continue }
      const res = await messaging.sendEach(devs.map((d) => ({
        token: d.data().token,
        data: { title: group.name || 'Your crew', body, url: `${APP_URL}#/chat`, tag: `fitpot-chat-${gid}` },
        webpush: { headers: { Urgency: 'normal', TTL: String(6 * 3600) } },
      })))
      chatSent += res.responses.filter((r) => r.success).length
    }
    if (!DRY) await ref.set({ lastChatMs: now.getTime() }, { merge: true })
  } catch (e) {
    console.warn('chat: skipped a user after an error:', e.message)
  }
}
console.log(`Crew chat notes: ${chatSent} sent.`)

console.log(`Reminders: ${sent} sent, ${skipped} not needed (checked in or rest day), ${removed} old devices removed. Local check: ${JSON.stringify(localNow(now, 'America/New_York'))}`)
