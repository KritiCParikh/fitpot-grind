import { useCheckins, useSubcollection } from '../hooks'
import { isValidCheckin, joinDay } from './group'
import { dayInTz } from './dates'
import { computeLedger } from './ledger'

// Normalise raw Firestore docs into what the pure ledger needs.
export function useLedgerInputs(group, from, to) {
  const tz = group.timezone
  const checkins = useCheckins(group.id, from, to)
  const restDocs = useSubcollection(group.id, 'restdays')
  const penaltyDocs = useSubcollection(group.id, 'penalties')
  if (!checkins || !restDocs || !penaltyDocs) return null

  const doneByDay = {}
  for (const c of checkins) if (isValidCheckin(c, tz)) (doneByDay[c.date] ||= new Set()).add(c.uid)

  // votes: { day: { uid: dayTheVoteWasCast } } — server time, group timezone
  const restVotes = {}
  for (const r of restDocs) {
    const v = {}
    for (const [uid, ts] of Object.entries(r.votes || {})) v[uid] = ts ? dayInTz(ts.toDate(), tz) : r.id
    restVotes[r.id] = v
  }

  // A change only counts if it was made BEFORE the day it takes effect.
  const penaltyChanges = penaltyDocs
    .filter((p) => !p.setAt || dayInTz(p.setAt.toDate(), tz) < p.effectiveDate)
    .map((p) => ({ effectiveDate: p.effectiveDate, penalty: p.penalty, setBy: p.setBy }))

  return { doneByDay, restVotes, restRaw: restDocs, penaltyChanges }
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
    startDay: group.createdAt ? dayInTz(group.createdAt.toDate(), tz) : undefined,
  })
}
