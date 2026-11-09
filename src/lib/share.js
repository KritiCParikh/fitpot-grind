// Share cards (phase 5.14): what a finished workout, or a month, adds up to,
// in FitPot's own words. Pure functions, no Firebase, so they're easy to test.
//
// The card talks about how you showed up, never how you compare: minutes,
// muscles, days in the gullak, a quiet line. No rankings, no "crushed it".

import { isCardio, cardioMetric, alsoOf, muscleLabel, muscleOfPart, MUSCLES, personalRecords } from './training'
import { addDays, mondayOf, monthDays, currentStreak } from './dates'

// Rough energy use, MET x kg x hours. Labelled "about" on the card.
const MET_STRENGTH = 5
const MET = { run: 9.8, 'treadmill-run': 9, walk: 3.5, cycle: 7.5, bike: 6.8, row: 7, elliptical: 5, swim: 7, 'stair-climber': 9, 'stairs-outdoor': 8, skipping: 11, hike: 6, trek: 7 }
const EFFORT_MET = { easy: 4, moderate: 6, hard: 8 }
const STRENGTH_MIN_PER_SET = 2.5 // when a workout has no timed length

/** Credited sets per muscle group: main muscle 1 per set, each also-muscle half (as in Training, Muscles). */
export function musclesWorked(w) {
  const out = {}
  for (const ex of w.exercises || []) {
    if (isCardio(ex)) continue
    const n = (ex.sets || []).filter((s) => Number(s.reps) > 0).length
    if (!n) continue
    out[ex.muscle] = (out[ex.muscle] || 0) + n
    for (const k of alsoOf(ex)) {
      const g = muscleOfPart(k) || k
      if (g !== ex.muscle && MUSCLES.some((m) => m.key === g)) out[g] = (out[g] || 0) + n / 2
    }
  }
  return Object.entries(out).filter(([k]) => k !== 'fullbody' && k !== 'cardio').sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: muscleLabel(k), sets: v }))
}

/** One workout, summed up for its card. weightKg is your latest weight (or null). */
export function workoutSummary(w, { weightKg = null } = {}) {
  let strengthSets = 0, cardioMin = 0, km = 0, kcal = 0
  const kg = weightKg || 70
  const activities = []
  for (const ex of w.exercises || []) {
    if (isCardio(ex)) {
      const sets = ex.sets || []
      const min = sets.reduce((a, s) => a + (Number(s.min) || 0), 0)
      cardioMin += min
      km += sets.reduce((a, s) => a + (Number(s.km) || 0), 0)
      const metric = ex.metric || cardioMetric(ex)
      const effort = ['hard', 'moderate', 'easy'].find((e) => sets.some((s) => s.effort === e)) || 'moderate'
      const met = metric === 'effort' ? EFFORT_MET[effort] : MET[ex.key] || 6
      kcal += met * kg * (min / 60)
      if (min > 0 || km > 0) activities.push(ex.name)
    } else {
      strengthSets += (ex.sets || []).filter((s) => Number(s.reps) > 0).length
    }
  }
  const strengthMin = w.durationMin ? Math.max(0, w.durationMin - cardioMin) : strengthSets * STRENGTH_MIN_PER_SET
  kcal += MET_STRENGTH * kg * (strengthMin / 60)
  const minutes = Math.round(w.durationMin || cardioMin + strengthMin)
  return {
    title: w.title || '',
    date: w.date,
    minutes,
    timed: Boolean(w.durationMin),
    sets: strengthSets,
    km: Math.round(km * 10) / 10,
    kcal: Math.round(kcal / 10) * 10,
    kcalGuess: !weightKg,
    muscles: musclesWorked(w),
    activities,
  }
}

/** New records this workout set (needs every workout, including this one). */
export function prsOf(workouts, id) {
  return personalRecords(workouts).byWorkout[id] || []
}

/**
 * Your days for the card: streak, this week's dots, this month's coins.
 * sessions: Map<day, count> (from useMyDays), including today's workout.
 */
export function daysContext(sessions, day) {
  const set = new Set(sessions.keys())
  const mon = mondayOf(day)
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(mon, i)
    return { day: d, n: sessions.get(d) || 0, today: d === day, future: d > day }
  })
  const [y, m] = day.split('-').map(Number)
  const month = monthDays(y, m - 1).map((d) => ({ day: d, n: sessions.get(d) || 0, future: d > day }))
  const monthDaysIn = month.filter((x) => x.n > 0).length
  const monthBoosts = month.reduce((a, x) => a + Math.max(0, x.n - 1), 0)
  const firstEver = set.size <= 1
  return { streak: currentStreak(set, day), week, weekDays: week.filter((x) => x.n > 0).length, month, monthDaysIn, monthBoosts, firstEver, todayN: sessions.get(day) || 1 }
}

// Kind words. Never about beating anyone, never about bodies or weight.
const LINES = {
  general: [
    'Showed up for myself today.',
    'Quiet progress counts.',
    'One more coin in the gullak.',
    'Not perfect. Just present.',
    'Small steps, kept promises.',
    'Did what I could today, and that is enough.',
    'Thankful for a body that moves.',
    'Today, I chose me.',
  ],
  first: ['Day one. Here is to many more.', 'Every habit starts with one day. This is mine.'],
  streak: (n) => [`${n} days of keeping a promise to myself.`, `${n} days in a row. Gently, steadily.`, `Day ${n}. Still showing up.`],
  pr: ['A new best, built one day at a time.', 'Grateful for the slow, steady kind of strong.', 'Stronger than last time. Thank you, consistency.'],
  boost: ['Moved more than once today. Feeling good.', 'Two sessions, one happy day.'],
  sports: ['Played for joy today.', 'Sweat, laughter and a good game.'],
  outdoor: ['Fresh air, steady steps.', 'Outside, moving, grateful.'],
  month: ['Every coin is a day I showed up.', 'A month of small promises, kept.', 'Not every day. Enough days.'],
}

/** A few lines that fit this moment; the card shows one and you can tap for another. */
export function kindLines({ prs = [], ctx, summary, month = false }) {
  if (month) return LINES.month
  const out = []
  if (ctx?.firstEver) out.push(...LINES.first)
  if (prs.length) out.push(...LINES.pr)
  if (ctx?.streak >= 3) out.push(...LINES.streak(ctx.streak))
  if (ctx?.todayN > 1) out.push(...LINES.boost)
  if (summary?.activities?.length && !summary.sets) out.push(...(summary.km ? LINES.outdoor : LINES.sports))
  out.push(...LINES.general)
  return [...new Set(out)]
}

/** "Bench press: 62.5 kg x 8" style lines for the card's PR ribbon. */
export function prText(p, u) {
  const v = p.kind === 'weight' ? u.show(p.value, p.reps)
    : p.kind === 'e1rm' ? `${u.toDisp(p.value)} ${u.unit} est. max`
      : p.kind === 'reps' ? `${p.value} reps`
        : p.kind === 'distance' ? `${u.toDist(p.value)} ${u.dist}`
          : p.kind === 'pace' ? u.showPace(p.value)
            : p.kind === 'time' ? `${p.value} min` : `${p.value}`
  return `${p.name}: ${v}`
}

/** A month, summed up (for "Share my month"). workouts: all of yours. */
export function monthSummary(workouts, sessions, day, { weightKg = null } = {}) {
  const ym = day.slice(0, 7)
  const inMonth = workouts.filter((w) => w.date?.startsWith(ym))
  let minutes = 0, kcal = 0
  const muscles = {}, acts = {}
  for (const w of inMonth) {
    const s = workoutSummary(w, { weightKg })
    minutes += s.minutes; kcal += s.kcal
    for (const m of s.muscles) muscles[m.label] = (muscles[m.label] || 0) + m.sets
    for (const a of s.activities) acts[a] = (acts[a] || 0) + 1
  }
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
  const ctx = daysContext(sessions, day)
  return { minutes: Math.round(minutes), kcal: Math.round(kcal / 10) * 10, workouts: inMonth.length, topMuscle: top(muscles), topActivity: top(acts), ctx, monthName: new Date(`${ym}-15T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', timeZone: 'UTC' }) }
}
