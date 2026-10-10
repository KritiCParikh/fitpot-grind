// FitPot clock - pure functions, no Firebase.
//
// Every member's "day" follows THEIR OWN phone's timezone, so friends in
// different countries each get a full local day (midnight to midnight).
//
//   • Each member doc stores the timezone their phone had when they joined.
//     Members from before Phase 5.1 have none and use the group's timezone.
//   • When a phone's timezone changes (travel, moving), the app logs it in
//     groups/{id}/tzchanges and it takes effect from that person's NEXT day.
//     That way nobody can stretch the day they're in by changing a setting.
//   • A day is CLOSED for the group once it has ended for everyone, i.e.
//     after the midnight of the member furthest behind (furthest west).
//     Only closed days and weeks are settled into the pot.

import { dayInTz, addDays } from './dates.js'

export const localTz = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}

const toDate = (t) => (t == null ? null : t instanceof Date ? t : t.toDate ? t.toDate() : new Date(t))
const ms = (t) => (t ? t.getTime() : Infinity) // pending (not yet stamped) writes sort last

function byEffective(a, b) {
  return a.effectiveDate < b.effectiveDate ? -1 : a.effectiveDate > b.effectiveDate ? 1 : ms(a.setAt) - ms(b.setAt)
}

// Timezone in force at `instant`, walking a member's sorted change list.
function tzAtList(base, list, instant) {
  let tz = base
  for (const c of list) {
    if (dayInTz(instant, tz) >= c.effectiveDate) tz = c.timezone
    else break
  }
  return tz
}

/**
 * groupTz:   the group's timezone (fallback for older members)
 * members:   [{ uid, timezone?, joinedAt?, joinedDate }]
 * tzChanges: raw docs [{ uid, timezone, effectiveDate, setAt }]
 * myUid:     the signed-in user
 */
export function makeClock({ groupTz, members, tzChanges = [], myUid }) {
  const base = {}
  const joinedAt = {}
  const leftAt = {}
  for (const m of members) {
    base[m.uid] = m.timezone || groupTz
    joinedAt[m.uid] = toDate(m.joinedAt)
    leftAt[m.uid] = toDate(m.leftAt)
  }
  const baseOf = (uid) => base[uid] || groupTz

  // Keep only valid changes: made BEFORE the day they take effect (in the
  // timezone the person was in when they made it).
  const lists = {}
  const raw = tzChanges
    .map((c) => ({ uid: c.uid, timezone: c.timezone, effectiveDate: c.effectiveDate, setAt: toDate(c.setAt) }))
    .filter((c) => c.uid && c.timezone && c.effectiveDate)
    .sort((a, b) => ms(a.setAt) - ms(b.setAt))
  for (const c of raw) {
    const list = (lists[c.uid] ||= [])
    if (c.setAt && dayInTz(c.setAt, tzAtList(baseOf(c.uid), list, c.setAt)) >= c.effectiveDate) continue
    list.push(c)
    list.sort(byEffective)
  }
  const listOf = (uid) => lists[uid] || []

  /** Timezone a member uses for calendar day `day`. */
  function tzOn(uid, day) {
    let tz = baseOf(uid)
    for (const c of listOf(uid)) if (c.effectiveDate <= day) tz = c.timezone
    return tz
  }
  /** Timezone a member is in at a moment in time. */
  const tzAt = (uid, instant = new Date()) => tzAtList(baseOf(uid), listOf(uid), instant)
  /** The member's own calendar day at a moment in time. */
  const dayOf = (uid, instant = new Date()) => dayInTz(instant, tzAt(uid, instant))
  const todayOf = (uid) => dayOf(uid, new Date())

  const joinedBy = (uid, instant) => !joinedAt[uid] || joinedAt[uid] <= instant
  const stillIn = (uid, instant) => !leftAt[uid] || leftAt[uid] > instant
  const uids = () => members.map((m) => m.uid)

  /** The furthest-ahead calendar day among members (who had joined by then). */
  function latestDay(instant = new Date()) {
    let max = ''
    for (const uid of uids()) if (joinedBy(uid, instant) && stillIn(uid, instant)) { const d = dayOf(uid, instant); if (d > max) max = d }
    return max || dayInTz(instant, groupTz)
  }
  /** The furthest-behind calendar day among members. */
  function earliestDay(instant = new Date()) {
    let min = ''
    for (const uid of uids()) {
      if (!stillIn(uid, instant)) continue // people who left don't hold the group's day open
      const d = dayOf(uid, instant); if (!min || d < min) min = d
    }
    return min || dayInTz(instant, groupTz)
  }

  return {
    groupTz,
    myUid,
    tzOn,
    tzAt,
    dayOf,
    todayOf,
    /** My own "today". */
    today: () => todayOf(myUid),
    /** My timezone right now. */
    myTz: () => tzAt(myUid),
    latestDay,
    /** Last day that has ended for EVERY member: settled days run up to here. */
    closedThrough: () => addDays(earliestDay(), -1),
    /** 'later' (hasn't started for them), 'open' (it's their today) or 'closed'. */
    stateFor(uid, day) {
      const t = todayOf(uid)
      return t < day ? 'later' : t === day ? 'open' : 'closed'
    },
    /** A member's join day, in their own timezone, from the server time. */
    joinDay(m) {
      const at = toDate(m.joinedAt)
      return at ? dayInTz(at, m.timezone || groupTz) : m.joinedDate
    },
    /** First day someone NO LONGER counts (the day after they left), or null. */
    leftDay(m) {
      const at = toDate(m.leftAt)
      return at ? addDays(dayInTz(at, tzAt(m.uid, at)), 1) : null
    },
    /** Has this member left the group (as of now)? */
    hasLeft: (uid) => Boolean(leftAt[uid]),
    /** The timezone my pending changes will leave me on (what the app last logged). */
    finalTz: (uid = myUid) => { const l = listOf(uid); return l.length ? l[l.length - 1].timezone : baseOf(uid) },
    /** Changes logged for a member that haven't kicked in yet. */
    pendingFor: (uid = myUid) => { const t = todayOf(uid); return listOf(uid).filter((c) => c.effectiveDate > t) },
  }
}

/**
 * Group setting logs (penalty, target, currency). A change counts only if it
 * was made before its effective day had started for ANY member who'd joined,
 * so the stakes of a day already underway somewhere never change.
 * Returns valid changes sorted by effectiveDate (ties: later change wins).
 */
export function validChanges(docs, clock, keys) {
  return (docs || [])
    .map((d) => {
      const out = { effectiveDate: d.effectiveDate, setBy: d.setBy, setAt: toDate(d.setAt) }
      for (const k of keys) out[k] = d[k]
      return out
    })
    .filter((c) => c.effectiveDate && (!c.setAt || clock.latestDay(c.setAt) < c.effectiveDate))
    .sort(byEffective)
}

/** A check-in/photo counts only if its SERVER time falls on its date in that person's timezone. */
export function onItsDay(item, clock) {
  const at = toDate(item.createdAt)
  if (!at) return true // our own write, still pending
  return dayInTz(at, clock.tzOn(item.uid, item.date)) === item.date
}

/** Short label like "IST" or "GMT+5:30" for a timezone. */
export function tzLabel(timeZone, at = new Date()) {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: 'short' })
      .formatToParts(at).find((p) => p.type === 'timeZoneName')?.value || timeZone
  } catch { return timeZone }
}

/** Local clock time somewhere, e.g. "6:30 AM Sat". */
export function localTime(timeZone, at = new Date()) {
  return at.toLocaleString(undefined, { timeZone, hour: 'numeric', minute: '2-digit', weekday: 'short' })
}

/** Your own today from your phone's timezone (for the Me tab, which needs no group). */
export const myToday = () => dayInTz(new Date(), localTz())
