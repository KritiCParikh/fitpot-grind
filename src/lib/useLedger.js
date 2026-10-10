import { useCheckins, useSubcollection } from '../hooks'
import { mondayOf } from './dates'
import { computeLedger } from './ledger'
import { validChanges, onItsDay } from './clock'

// Normalise raw Firestore docs into what the pure ledger needs.
// Check-ins are loaded from the Monday of `from`'s week, so weekly targets work.
// `group.clock` (each member's own timezone) and `group.money` (currency) are
// attached in App.jsx.
export function useLedgerInputs(group, from, to) {
  const { clock } = group
  const checkins = useCheckins(group.id, mondayOf(from), to)
  const restDocs = useSubcollection(group.id, 'restdays')
  const penaltyDocs = useSubcollection(group.id, 'penalties')
  const targetDocs = useSubcollection(group.id, 'targets')
  if (!checkins || !restDocs || !penaltyDocs || !targetDocs) return null

  // A check-in counts only if Google's server time falls on its date in
  // THAT person's timezone for that day.
  const doneByDay = {}
  for (const c of checkins) if (onItsDay(c, clock)) (doneByDay[c.date] ||= new Set()).add(c.uid)

  // votes: { day: { uid: dayTheVoteWasCast } } - server time, the VOTER's own timezone
  const restVotes = {}
  for (const r of restDocs) {
    const v = {}
    for (const [uid, ts] of Object.entries(r.votes || {})) v[uid] = ts ? clock.dayOf(uid, ts.toDate()) : r.id
    restVotes[r.id] = v
  }

  return {
    doneByDay,
    restVotes,
    penaltyChanges: validChanges(penaltyDocs, clock, ['penalty']),
    targetChanges: validChanges(targetDocs, clock, ['target']),
  }
}

export function runLedger(group, members, inputs, from, to) {
  const { clock, money } = group
  return computeLedger({
    from, to,
    members: members.map((m) => ({ uid: m.uid, joinDay: clock.joinDay(m), leftDay: clock.leftDay(m) })),
    doneByDay: inputs.doneByDay,
    restVotes: inputs.restVotes,
    basePenalty: group.penalty,
    penaltyChanges: inputs.penaltyChanges,
    baseTarget: group.weeklyTarget ?? 7,
    targetChanges: inputs.targetChanges,
    startDay: group.createdAt ? clock.dayOf(group.createdBy, group.createdAt.toDate()) : undefined,
    factorOn: money.factorOn,
  })
}
