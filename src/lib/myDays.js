import { useUserDoc, useMineEverywhere, allMyGroupIds } from '../hooks'
import { useWorkouts } from './privateData'

// Your worked-out days for My calendar (phase 5.12, sync fixed in 5.13).
// A day counts if you checked in to ANY group you're in or were in (past
// check-ins included), or logged a workout in Training, so with no crew it
// runs on your Training logs alone.
// Sessions (phase 5.13): a check-in plus extra sessions that day in a group
// (morning gym, evening run, tennis at night), or several logged workouts.
// The day's count is the most of those; anything over 1 is a +1, +2 boost.
// Returns { days: Map<YYYY-MM-DD, sessions>, loading }.
export function useMyDays(user) {
  const profile = useUserDoc(user.uid)
  const ids = allMyGroupIds(profile)
  const workouts = useWorkouts(user.uid)
  const checkins = useMineEverywhere(ids, user.uid, 'checkins')
  const extras = useMineEverywhere(ids, user.uid, 'sessions')
  // Train together (phase 5.15): a day you and at least one friend both showed up for = +1.
  const together = useMineEverywhere(ids, user.uid, 'together', 'done')
  const days = new Map()
  const bump = (d, n) => { if (d) days.set(d, Math.max(days.get(d) || 0, n)) }
  const perGroup = {}
  for (const c of checkins) perGroup[`${c.gid}|${c.date}`] = 1
  for (const x of extras) perGroup[`${x.gid}|${x.date}`] = (perGroup[`${x.gid}|${x.date}`] || 1) + 1
  for (const [k, n] of Object.entries(perGroup)) bump(k.split('|')[1], n)
  const logged = {}
  for (const w of workouts || []) if (w.date) logged[w.date] = (logged[w.date] || 0) + 1
  for (const [d, n] of Object.entries(logged)) bump(d, n)
  const togetherDays = new Set(together.filter((t) => (t.done || []).length >= 2).map((t) => t.day))
  for (const d of togetherDays) if (days.has(d)) days.set(d, days.get(d) + 1)
  return { days, togetherDays, loading: profile === undefined || workouts === undefined }
}

/** "+1", "+2" for a day with that many sessions, else ''. */
export const boostLabel = (sessions) => (sessions > 1 ? `+${sessions - 1}` : '')
