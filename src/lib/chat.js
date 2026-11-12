// Crew chat (phase 5.15). Everything lives under the group, so only members
// can read it (see firestore-rules-5.15.txt):
//
//   groups/{gid}/chat/{id}          a message: { uid, name, kind, day, createdAt, ...kind fields }
//     kind 'text'     text
//     kind 'cheer'    cheer (one of CHEERS), optional to (uid it's for)
//     kind 'invite'   Train together: { invite: { day, part, note } }, members and done live in together/{id}
//     kind 'card'     a workout or month share card: { card } (drawn again in the chat)
//     kind 'routine'  a shared routine: { routine: { name, items, autoFill, curatedBy, curatedByName } }
//   groups/{gid}/cheers/{msgId_uid} Spot me on a message: { msgId, uid, cheer, day, createdAt }
//   groups/{gid}/together/{msgId}   Train together: { uid, day, part, members: [uid], done: [uid] }
//   groups/{gid}/floor/{uid}        On the floor: who has a workout open right now
//
// No likes, no counts, no ranking: cheers show who sent them, not how many.

import { useEffect, useState } from 'react'
import { doc, collection, query, where, orderBy, limit, onSnapshot, setDoc, addDoc, deleteDoc, updateDoc, serverTimestamp, arrayUnion, arrayRemove, getDoc, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { addDays } from './dates'
import { myToday } from './clock'
import { local } from './device'

export const CHEERS = ['Spotting you', 'Proud of you', 'Rest well', 'Same time tomorrow?', 'You showed up', 'Go gently']
export const CHAT_DAYS = 14 // how far back the chat shows
const MAX_TEXT = 600
const firstName = (user) => (user.displayName || 'Someone').split(' ')[0]

const chatCol = (gid) => collection(db, 'groups', gid, 'chat')

/** The last CHAT_DAYS of messages, oldest first. Live. */
export function useChat(gid) {
  const [msgs, setMsgs] = useState(undefined)
  useEffect(() => {
    if (!gid) return
    setMsgs(undefined)
    const q = query(chatCol(gid), orderBy('createdAt', 'desc'), limit(200))
    return onSnapshot(q, (s) => {
      const since = addDays(myToday(), -CHAT_DAYS)
      const list = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => !m.day || m.day >= since)
      list.sort((a, b) => (a.createdAt?.toMillis?.() ?? Infinity) - (b.createdAt?.toMillis?.() ?? Infinity))
      setMsgs(list)
    }, () => setMsgs([]))
  }, [gid])
  return msgs
}

/** Docs with a `day` from CHAT_DAYS ago (cheers, together). Live. */
function useRecent(gid, name) {
  const [docs, setDocs] = useState([])
  useEffect(() => {
    if (!gid) return
    const q = query(collection(db, 'groups', gid, name), where('day', '>=', addDays(myToday(), -CHAT_DAYS)))
    return onSnapshot(q, (s) => setDocs(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setDocs([]))
  }, [gid, name])
  return docs
}
export const useCheers = (gid) => useRecent(gid, 'cheers')
export const useTogether = (gid) => useRecent(gid, 'together')

/** Who's on the floor (a workout open in the last 20 minutes). Live. */
export function useFloor(gid) {
  const [docs, setDocs] = useState([])
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])
  useEffect(() => {
    if (!gid) return
    return onSnapshot(collection(db, 'groups', gid, 'floor'), (s) => setDocs(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setDocs([]))
  }, [gid])
  return docs.filter((d) => d.at && now - d.at < 20 * 60000)
}

// ---------- writing ----------

function base(user, kind) {
  return { uid: user.uid, name: firstName(user), kind, day: myToday(), createdAt: serverTimestamp() }
}

export function sendText(user, gid, text) {
  const t = text.trim().slice(0, MAX_TEXT)
  if (!t) return null
  return addDoc(chatCol(gid), { ...base(user, 'text'), text: t })
}

export function sendCheer(user, gid, cheer, to = null) {
  return addDoc(chatCol(gid), { ...base(user, 'cheer'), cheer, ...(to ? { to } : {}) })
}

/** Spot me on a message: one cheer per person per message; tap again to take it back. */
export async function toggleSpot(user, gid, msgId, cheer = 'Spotting you') {
  const ref = doc(db, 'groups', gid, 'cheers', `${msgId}_${user.uid}`)
  const had = (await getDoc(ref)).exists()
  if (had) return deleteDoc(ref)
  return setDoc(ref, { msgId, uid: user.uid, name: firstName(user), cheer, day: myToday(), createdAt: serverTimestamp() })
}

/** Train together: a message plus its together doc, with you already in. */
export async function sendInvite(user, gid, { day, part, note = '' }) {
  const ref = doc(chatCol(gid))
  await setDoc(doc(db, 'groups', gid, 'together', ref.id), { uid: user.uid, day, part, members: [user.uid], done: [], createdAt: serverTimestamp() })
  await setDoc(ref, { ...base(user, 'invite'), invite: { day, part, note: note.trim().slice(0, 140) } })
  return ref
}

export const joinInvite = (user, gid, id) => updateDoc(doc(db, 'groups', gid, 'together', id), { members: arrayUnion(user.uid) })
export const leaveInvite = (user, gid, id) => updateDoc(doc(db, 'groups', gid, 'together', id), { members: arrayRemove(user.uid), done: arrayRemove(user.uid) })

/**
 * You worked out on `day`: tick yourself off in every Train together you said
 * I'm in to for that day, in all your groups. Both ticked = a shared boost.
 */
export async function markTogetherDone(user, groupIds, day = myToday()) {
  for (const gid of groupIds || []) {
    try {
      const s = await getDocs(query(collection(db, 'groups', gid, 'together'), where('day', '==', day)))
      for (const d of s.docs) {
        const t = d.data()
        if ((t.members || []).includes(user.uid) && !(t.done || []).includes(user.uid)) {
          await updateDoc(d.ref, { done: arrayUnion(user.uid) }).catch(() => {})
        }
      }
    } catch { /* not readable: skip */ }
  }
}

/** Post a share card (from the share screen) to a crew chat. */
export function sendCard(user, gid, card) {
  // Keep only what's needed to draw it again; no exercise list, nothing private beyond the card.
  const { kind, style, headline, subline, stats, muscles, prs, line, dateLabel, ctx, heat } = card
  const slim = { kind, style, headline, subline, stats, muscles, prs, line, dateLabel, heat: heat || {}, ctx: ctx ? { week: ctx.week, weekDays: ctx.weekDays, monthDaysIn: ctx.monthDaysIn, monthBoosts: ctx.monthBoosts, streak: ctx.streak } : {} }
  return addDoc(chatCol(gid), { ...base(user, 'card'), card: JSON.parse(JSON.stringify(slim)) })
}

/** Share a routine into a crew chat. */
export function sendRoutine(user, gid, routine) {
  return addDoc(chatCol(gid), { ...base(user, 'routine'), routine: shareableRoutine(user, routine) })
}

export const deleteMessage = (gid, id) => deleteDoc(doc(db, 'groups', gid, 'chat', id))

// ---------- On the floor ----------

/**
 * While a workout is open, tell your active groups what you're on. Throttled
 * by the caller; `null` clears it (saved or closed).
 */
export async function setFloor(user, groupIds, status) {
  for (const gid of groupIds || []) {
    const ref = doc(db, 'groups', gid, 'floor', user.uid)
    try {
      if (!status) await deleteDoc(ref)
      else await setDoc(ref, { uid: user.uid, name: firstName(user), ...status, at: Date.now(), updatedAt: serverTimestamp() })
    } catch { /* left or offline: fine */ }
  }
}

// ---------- routines ----------

/** A routine as it travels: no ids, who curated it. Already-shared routines keep their first curator. */
export function shareableRoutine(user, r) {
  return {
    name: r.name || 'Routine',
    items: (r.items || []).map(({ rowId: _r, ...it }) => it),
    autoFill: r.autoFill !== false,
    curatedBy: r.curatedBy || user.uid,
    curatedByName: r.curatedByName || firstName(user),
  }
}

// Links: #/r/<base64url JSON>. Anyone with FitPot can open one.
const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))
const SHORT = { key: 'k', name: 'n', muscle: 'm', part: 'p', also: 'a', kind: 'c', metric: 'x', cat: 't', sets: 's', reps: 'r', min: 'i' }
const LONG = Object.fromEntries(Object.entries(SHORT).map(([a, b]) => [b, a]))
const shrink = (o, map) => Object.fromEntries(Object.entries(o).map(([k, v]) => [map[k] || k, v]))

export function routineLink(user, r) {
  const s = shareableRoutine(user, r)
  const data = b64(JSON.stringify({ v: 1, n: s.name, f: s.autoFill ? 1 : 0, by: s.curatedByName, bu: s.curatedBy, i: s.items.map((it) => shrink(it, SHORT)) }))
  return `${location.origin}${location.pathname}#/r/${data}`
}

export function parseRoutineLink(data) {
  try {
    const o = JSON.parse(unb64(data))
    if (o.v !== 1 || !Array.isArray(o.i)) return null
    return { name: String(o.n || 'Routine').slice(0, 40), autoFill: o.f !== 0, curatedByName: String(o.by || '').slice(0, 30), curatedBy: String(o.bu || ''), items: o.i.slice(0, 30).map((it) => shrink(it, LONG)) }
  } catch { return null }
}

// ---------- Unread (phase 5.16) ----------
// When you last looked at a crew's chat, on this phone. New messages from
// others after that show as a small count on the Crew tab and the Chat tile.
const readKey = (uid, gid) => `fitpot-chat-read-${uid}-${gid}`
const READ_EVT = 'fitpot-chat-read'
export function markChatRead(uid, gid) {
  local.set(readKey(uid, gid), String(Date.now()))
  window.dispatchEvent(new Event(READ_EVT))
}

/** How many messages others sent since you last opened this chat (up to 20). Live. */
export function useUnread(gid, uid) {
  const [msgs, setMsgs] = useState([])
  const [readAt, setReadAt] = useState(() => Number(local.get(readKey(uid, gid))) || 0)
  useEffect(() => {
    const up = () => setReadAt(Number(local.get(readKey(uid, gid))) || 0)
    up()
    window.addEventListener(READ_EVT, up)
    return () => window.removeEventListener(READ_EVT, up)
  }, [uid, gid])
  useEffect(() => {
    if (!gid || !uid) return
    const q = query(chatCol(gid), orderBy('createdAt', 'desc'), limit(20))
    return onSnapshot(q, (s) => setMsgs(s.docs.map((d) => d.data())), () => setMsgs([]))
  }, [gid, uid])
  // First visit ever: don't flag the whole history as new.
  if (!readAt) return 0
  return msgs.filter((m) => m.uid !== uid && (m.createdAt?.toMillis?.() || 0) > readAt).length
}

/** Tell the crew two people squared up (phase 5.16). Never shows the amount. */
export function sendSettle(user, gid, { other, otherName, method }) {
  return addDoc(chatCol(gid), { ...base(user, 'settle'), settle: { other, otherName: (otherName || '').split(' ')[0], method } })
}
