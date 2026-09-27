import { useCheckins, useSubcollection } from '../hooks'
import { isValidCheckin, joinDay } from './group'
import { dayInTz, mondayOf } from './dates'
import { computeLedger } from './ledger'

// A logged change only counts if it was made BEFORE the day it takes effect.
function validChanges(docs, tz, key) {
  return (docs || [])
    .filter((p) => !p.setAt || dayInTz(p.setAt.toDate(), tz) < p.effectiveDate)
    .map((p) => ({ effectiveDate: p.effectiveDate, [key]: p[key], setBy: p.setBy }))
}

// Normalise raw Firestore docs into what the pure ledger needs.
// Check-ins are loaded from the Monday of `from`'s week, so weekly targets work.
export function useLedgerInputs(group, from, to) {
  const tz = group.timezone
  const checkins = useCheckins(group.id, mondayOf(from), to)
  const restDocs = useSubcollection(group.id, 'restdays')
  const penaltyDocs = useSubcollection(group.id, 'penalties')
  const targetDocs = useSubcollection(group.id, 'targets')
  if (!checkins || !restDocs || !penaltyDocs || !targetDocs) return null

  const doneByDay = {}
  for (const c of checkins) if (isValidCheckin(c, tz)) (doneByDay[c.date] ||= new Set()).add(c.uid)

  // votes: { day: { uid: dayTheVoteWasCast } } — server time, group timezone
  const restVotes = {}
  for (const r of restDocs) {
    const v = {}
    for (const [uid, ts] of Object.entries(r.votes || {})) v[uid] = ts ? dayInTz(ts.toDate(), tz) : r.id
    restVotes[r.id] = v
  }

  return {
    doneByDay,
    restVotes,
    penaltyChanges: validChanges(penaltyDocs, tz, 'penalty'),
    targetChanges: validChanges(targetDocs, tz, 'target'),
  }
}

export function runLedger(group, members, inputs, from, to) {
  const tz = group.timezone
  return computeLedger({
    from, to,
    members: members.map((m) => ({ uid: m.uid, joinDay: joinDay(m, tz) })),
    doneByDay: inputs.doneByDay,
    restVotes: inputs.restVotes,
    basePenalty: group.penalty,
    penaltyChanges: inputs.penaltyChanges,
    baseTarget: group.weeklyTarget ?? 7,
    targetChanges: inputs.targetChanges,
    startDay: group.createdAt ? dayInTz(group.createdAt.toDate(), tz) : undefined,
  })
}
