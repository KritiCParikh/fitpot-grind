// FitPot ledger — pure functions, no Firebase. Everything money-related is
// derived from check-ins, members, rest-day votes and setting changes, so the
// numbers can always be recomputed and nobody can edit a balance directly.
//
// The group's "workout days per week" target picks the mode, per week:
//
// DAILY mode (target 7), for each finished day D:
//   active  = members who had joined by D
//   rest day (majority voted before D ended) → nobody pays
//   missed  = active members with no check-in on D
//   pot     = missed × penalty(D), split evenly among those who checked in
//   if NOBODY checked in, nobody pays (there's no one to pay)
//
// WEEKLY mode (target 1–6), for each finished week Mon→Sun:
//   active  = members who had joined by that Monday (a partial first week is free)
//   target  = weekly target − number of rest days that week (min 0)
//   short   = max(0, target − workouts that week)
//   each member pays short × penalty(Monday); the pot is split evenly among
//   everyone who hit the target. If nobody hit it, nobody pays.

import { addDays, mondayOf } from './dates.js'

const cents = (x) => Math.round(x * 100) / 100

/** Latest change with effectiveDate <= day, else the base value. */
export function valueOn(day, base, changes, key) {
  let v = base, latest = ''
  for (const c of changes) {
    if (c.effectiveDate <= day && c.effectiveDate > latest) { latest = c.effectiveDate; v = c[key] }
  }
  return v
}

export const penaltyOn = (day, base, changes) => valueOn(day, base, changes, 'penalty')
export const targetOn = (day, base, changes) => valueOn(mondayOf(day), base ?? 7, changes, 'target')

/** votes: { uid: dayTheVoteWasCast }. A vote counts only if cast on or before the day. */
export function isRestDay(day, votes, activeUids) {
  if (!votes || !activeUids.length) return false
  const yes = activeUids.filter((uid) => votes[uid] && votes[uid] <= day).length
  return yes > activeUids.length / 2
}

/**
 * members:   [{ uid, joinDay }]
 * doneByDay: { 'YYYY-MM-DD': Set<uid> }             (valid check-ins only)
 * restVotes: { 'YYYY-MM-DD': { uid: voteDay } }
 * Daily-mode days are included when the day is in [from, to].
 * Weekly-mode weeks are settled when their Sunday is in [from, to].
 * Needs check-ins from mondayOf(from) onward.
 * Returns { days, weeks, totals: { uid: net } }.
 */
export function computeLedger({
  from, to, members, doneByDay, restVotes,
  basePenalty, penaltyChanges, baseTarget = 7, targetChanges = [], startDay,
}) {
  const totals = Object.fromEntries(members.map((m) => [m.uid, 0]))
  const days = [], weeks = []

  for (let mon = mondayOf(from); mon <= to; mon = addDays(mon, 7)) {
    const sun = addDays(mon, 6)
    const target = valueOn(mon, baseTarget, targetChanges, 'target')

    if (target >= 7) {
      // ---- daily mode ----
      for (let day = mon; day <= sun; day = addDays(day, 1)) {
        if (day < from || day > to || (startDay && day < startDay)) continue
        const active = members.filter((m) => m.joinDay <= day).map((m) => m.uid)
        if (!active.length) continue
        const penalty = penaltyOn(day, basePenalty, penaltyChanges)
        const done = doneByDay[day] || new Set()
        const showed = active.filter((u) => done.has(u))
        const missed = active.filter((u) => !done.has(u))
        const rest = isRestDay(day, restVotes[day], active)
        let pot = 0, each = 0
        if (!rest && showed.length && missed.length && penalty > 0) {
          pot = missed.length * penalty
          each = pot / showed.length
          for (const u of missed) totals[u] -= penalty
          for (const u of showed) totals[u] += each
        }
        days.push({ day, mode: 'daily', penalty, rest, showed, missed, pot, each })
      }
      continue
    }

    // ---- weekly mode ----
    // Per-day info (for the calendar), no money attached.
    for (let day = mon; day <= sun; day = addDays(day, 1)) {
      if (day < from || day > to || (startDay && day < startDay)) continue
      const active = members.filter((m) => m.joinDay <= day).map((m) => m.uid)
      if (!active.length) continue
      const done = doneByDay[day] || new Set()
      days.push({
        day, mode: 'weekly', penalty: penaltyOn(mon, basePenalty, penaltyChanges),
        rest: isRestDay(day, restVotes[day], active),
        showed: active.filter((u) => done.has(u)), missed: active.filter((u) => !done.has(u)),
        pot: 0, each: 0,
      })
    }

    if (sun < from || sun > to) continue // settle only weeks that END inside the range
    if (startDay && mon < startDay) continue // the group's first partial week is free
    const active = members.filter((m) => m.joinDay <= mon).map((m) => m.uid)
    if (!active.length) continue

    let restDays = 0
    const counts = Object.fromEntries(active.map((u) => [u, 0]))
    for (let day = mon; day <= sun; day = addDays(day, 1)) {
      if (isRestDay(day, restVotes[day], active)) restDays++
      const done = doneByDay[day]
      if (done) for (const u of active) if (done.has(u)) counts[u]++
    }
    const needed = Math.max(0, target - restDays)
    const penalty = penaltyOn(mon, basePenalty, penaltyChanges)
    const short = Object.fromEntries(active.map((u) => [u, Math.max(0, needed - counts[u])]))
    const hit = active.filter((u) => short[u] === 0)
    const missedUids = active.filter((u) => short[u] > 0)

    let pot = 0, each = 0
    if (hit.length && missedUids.length && penalty > 0) {
      pot = missedUids.reduce((s, u) => s + short[u] * penalty, 0)
      each = pot / hit.length
      for (const u of missedUids) totals[u] -= short[u] * penalty
      for (const u of hit) totals[u] += each
    }
    weeks.push({ mon, sun, target, restDays, needed, penalty, counts, short, hit, pot, each })
  }

  for (const u in totals) totals[u] = cents(totals[u])
  return { days, weeks, totals }
}

/** Fewest-transfers settle-up. totals: { uid: net } (positive = is owed). */
export function settleUp(totals) {
  const creditors = [], debtors = []
  for (const [uid, v] of Object.entries(totals)) {
    if (v > 0.004) creditors.push({ uid, amt: v })
    else if (v < -0.004) debtors.push({ uid, amt: -v })
  }
  creditors.sort((a, b) => b.amt - a.amt)
  debtors.sort((a, b) => b.amt - a.amt)
  const out = []
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = cents(Math.min(debtors[i].amt, creditors[j].amt))
    if (amount > 0) out.push({ from: debtors[i].uid, to: creditors[j].uid, amount })
    debtors[i].amt = cents(debtors[i].amt - amount)
    creditors[j].amt = cents(creditors[j].amt - amount)
    if (debtors[i].amt <= 0.004) i++
    if (creditors[j].amt <= 0.004) j++
  }
  return out
}
