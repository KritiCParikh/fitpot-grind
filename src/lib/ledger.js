// FitPot ledger — pure functions, no Firebase. Everything money-related is
// derived from check-ins, members, rest-day votes and penalty changes, so the
// numbers can always be recomputed and nobody can edit a balance directly.
//
// Rules for one finished day D:
//   active  = members who had joined by D
//   rest day (majority of active members voted before D ended) → nobody pays
//   missed  = active members with no valid check-in on D
//   pot     = missed × penalty(D)
//   each person who showed gets pot / showed; each who missed pays penalty(D)
//   if NOBODY showed, nobody is charged (there's no one to pay)

import { addDays } from './dates.js'

// Round to cents without floating-point drift in totals.
const cents = (x) => Math.round(x * 100) / 100

/**
 * penalty in effect on `day`.
 * changes: [{ effectiveDate: 'YYYY-MM-DD', penalty: number }], only valid ones.
 */
export function penaltyOn(day, basePenalty, changes) {
  let p = basePenalty
  let latest = ''
  for (const c of changes) {
    if (c.effectiveDate <= day && c.effectiveDate > latest) { latest = c.effectiveDate; p = c.penalty }
  }
  return p
}

/**
 * Is `day` a rest day? votes: { uid: 'YYYY-MM-DD' (day the vote was cast) }.
 * A vote counts only if cast on or before the day itself.
 */
export function isRestDay(day, votes, activeUids) {
  if (!votes || !activeUids.length) return false
  const yes = activeUids.filter((uid) => votes[uid] && votes[uid] <= day).length
  return yes > activeUids.length / 2
}

/**
 * Compute every day from `from` to `to` (inclusive).
 * members:   [{ uid, joinDay }]
 * doneByDay: { 'YYYY-MM-DD': Set<uid> }        (valid check-ins only)
 * restVotes: { 'YYYY-MM-DD': { uid: voteDay } }
 * Returns { days: [{ day, penalty, rest, showed, missed, pot, each }], totals: { uid: net } }
 */
export function computeLedger({ from, to, members, doneByDay, restVotes, basePenalty, penaltyChanges, startDay }) {
  const totals = Object.fromEntries(members.map((m) => [m.uid, 0]))
  const days = []
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (startDay && day < startDay) continue
    const active = members.filter((m) => m.joinDay <= day)
    if (!active.length) continue
    const activeUids = active.map((m) => m.uid)
    const penalty = penaltyOn(day, basePenalty, penaltyChanges)
    const done = doneByDay[day] || new Set()
    const showed = activeUids.filter((u) => done.has(u))
    const missed = activeUids.filter((u) => !done.has(u))
    const rest = isRestDay(day, restVotes[day], activeUids)

    let pot = 0, each = 0
    if (!rest && showed.length && missed.length && penalty > 0) {
      pot = missed.length * penalty
      each = pot / showed.length
      for (const u of missed) totals[u] -= penalty
      for (const u of showed) totals[u] += each
    }
    days.push({ day, penalty, rest, showed, missed, pot, each })
  }
  for (const u in totals) totals[u] = cents(totals[u])
  return { days, totals }
}

/**
 * Fewest-transfers settle-up: who pays whom.
 * totals: { uid: net } (positive = is owed). Returns [{ from, to, amount }].
 */
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
