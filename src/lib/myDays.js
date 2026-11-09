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
  const days = new Map()
  const bump = (d, n) => { if (d) days.set(d, Math.max(days.get(d) || 0, n)) }
  const perGroup = {}
  for (const c of checkins) perGroup[`${c.gid}|${c.date}`] = 1
  for (const x of extras) perGroup[`${x.gid}|${x.date}`] = (perGroup[`${x.gid}|${x.date}`] || 1) + 1
  for (const [k, n] of Object.entries(perGroup)) bump(k.split('|')[1], n)
  const logged = {}
  for (const w of workouts || []) if (w.date) logged[w.date] = (logged[w.date] || 0) + 1
  for (const [d, n] of Object.entries(logged)) bump(d, n)
  return { days, loading: profile === undefined || workouts === undefined }
}

/** "+1", "+2" for a day with that many sessions, else ''. */
export const boostLabel = (sessions) => (sessions > 1 ? `+${sessions - 1}` : '')
