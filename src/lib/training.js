// Training (progressive overload) - pure logic, no Firebase.
//
// A workout is { id, date, title, notes, exercises: [{ key, name, muscle, sets: [...] }] }.
// Strength sets are { reps, kg } (kg 0 = bodyweight only). Cardio sets are
// { km, min, count } (phase 5.4). Weights are stored in kg and distances in km,
// whatever unit you log in. From that we work out:
//   • "last time" for an exercise, so you know what to beat
//   • personal records (PRs): heaviest weight, best estimated 1-rep max, most reps
//   • per week, per muscle group: sets, volume and each exercise's best set vs last week

import { addDays, mondayOf } from './dates.js'

// Muscle groups, each with optional specific parts (phase 5.10, after the
// MuscleWiki breakdown). A part's key is also its region on the body map.
// Groups with no parts use their own key as the region. Old workouts only
// carry the group key, and that still works everywhere.
const P = (key, label) => ({ key, label })
export const MUSCLES = [
  { key: 'neck', label: 'Neck', parts: [] },
  { key: 'traps', label: 'Traps', parts: [P('traps_upper', 'Upper traps'), P('traps_mid', 'Mid-back traps'), P('traps_lower', 'Lower traps')] },
  { key: 'shoulders', label: 'Shoulders', parts: [P('delt_front', 'Front delts'), P('delt_side', 'Side delts'), P('delt_rear', 'Rear delts')] },
  { key: 'chest', label: 'Chest', parts: [P('chest_upper', 'Upper chest'), P('chest_lower', 'Mid and lower chest')] },
  { key: 'back', label: 'Back', parts: [P('lats', 'Lats'), P('lower_back', 'Lower back')] },
  { key: 'biceps', label: 'Biceps', parts: [P('bi_long', 'Long head'), P('bi_short', 'Short head')] },
  { key: 'triceps', label: 'Triceps', parts: [P('tri_long', 'Long head'), P('tri_lat', 'Lateral head'), P('tri_med', 'Medial head')] },
  { key: 'forearms', label: 'Forearms', parts: [P('fa_flex', 'Wrist flexors'), P('fa_ext', 'Wrist extensors'), P('grip', 'Grip and hands')] },
  { key: 'core', label: 'Abs and core', parts: [P('abs_upper', 'Upper abs'), P('abs_lower', 'Lower abs'), P('obliques', 'Obliques')] },
  { key: 'glutes', label: 'Glutes', parts: [P('glute_max', 'Glute max'), P('glute_med', 'Glute med')] },
  { key: 'quads', label: 'Quads', parts: [P('quad_rf', 'Rectus femoris'), P('quad_in', 'Inner quad'), P('quad_out', 'Outer quad')] },
  { key: 'hamstrings', label: 'Hamstrings', parts: [P('ham_in', 'Inner hamstrings'), P('ham_out', 'Outer hamstrings')] },
  { key: 'adductors', label: 'Inner thigh / Groin', parts: [] },
  { key: 'calves', label: 'Calves', parts: [P('gastroc', 'Gastrocnemius'), P('soleus', 'Soleus')] },
  { key: 'shins', label: 'Shins', parts: [] },
  { key: 'feet', label: 'Feet', parts: [] },
  { key: 'fullbody', label: 'Full body', parts: [], noMap: true },
  { key: 'cardio', label: 'Cardio', parts: [], noMap: true },
]
const PART_INFO = Object.fromEntries(MUSCLES.flatMap((m) => m.parts.map((p) => [p.key, { ...p, muscle: m.key }])))
/** Label of a specific part, e.g. 'traps_mid' -> 'Mid-back traps'. */
export const partLabel = (k) => PART_INFO[k]?.label || ''
/** Which group a part belongs to. */
export const muscleOfPart = (k) => PART_INFO[k]?.muscle || ''
/** "Traps / Mid-back traps", or just "Traps". */
export const muscleText = (muscle, part) => (part && PART_INFO[part] ? `${muscleLabel(muscle)} / ${partLabel(part)}` : muscleLabel(muscle))
/** Body map regions of a group: its parts, or the group itself. */
export function regionsOf(muscle) {
  const m = MUSCLES.find((x) => x.key === muscle)
  if (!m || m.noMap) return []
  return m.parts.length ? m.parts.map((p) => p.key) : [m.key]
}
/** The group and part for a tapped region of the body map. */
export function fromRegion(region) {
  if (PART_INFO[region]) return { muscle: PART_INFO[region].muscle, part: region }
  return MUSCLES.some((m) => m.key === region) ? { muscle: region, part: '' } : null
}
/** Label for a body map region. */
export const regionLabel = (r) => partLabel(r) || muscleLabel(r)
export const muscleLabel = (k) => MUSCLES.find((m) => m.key === k)?.label || 'Other'

// Equipment checklist. 'bodyweight' is always available.
export const EQUIPMENT = [
  { key: 'barbell', label: 'Barbell + plates' },
  { key: 'dumbbell', label: 'Dumbbells' },
  { key: 'kettlebell', label: 'Kettlebells' },
  { key: 'ezbar', label: 'EZ curl bar' },
  { key: 'bench', label: 'Bench (flat/incline)' },
  { key: 'rack', label: 'Squat rack / power rack' },
  { key: 'smith', label: 'Smith machine' },
  { key: 'cable', label: 'Cable machine / pulley' },
  { key: 'legpress', label: 'Leg press' },
  { key: 'machine', label: 'Other weight machines' },
  { key: 'pullup', label: 'Pull-up bar' },
  { key: 'dip', label: 'Dip bars' },
  { key: 'bands', label: 'Resistance bands' },
  { key: 'abwheel', label: 'Ab wheel' },
  { key: 'treadmill', label: 'Treadmill' },
  { key: 'bike', label: 'Stationary bike' },
  { key: 'rower', label: 'Rowing machine' },
  { key: 'elliptical', label: 'Elliptical' },
  { key: 'stairs', label: 'Stair climber' },
  { key: 'jumprope', label: 'Jump rope' },
  { key: 'bicycle', label: 'Bicycle (outdoor)' },
  { key: 'pool', label: 'Swimming pool' },
]

// Built-in exercises: key, name, primary muscle, equipment (any one of these works),
// and the specific part it targets most, where that's clear (optional).
// `also` (phase 5.12.1): other muscles it works hard too, e.g. a Romanian
// deadlift is hamstrings, also glutes and lower back. Each also-muscle gets
// half a set in Training > Muscles. Group or part keys both work.
const X = (key, name, muscle, eq, part, also) => ({ key, name, muscle, eq, ...(part ? { part } : {}), ...(also ? { also } : {}) })
// Cardio: metric 'distance' logs distance + time; 'time' logs time + a count
// (floors, jumps); 'effort' (phase 5.12.1, sports) logs time + easy / moderate / hard.
// cat: 'machine' (gym cardio), 'outdoor', 'sports'.
const C = (key, name, eq, metric = 'distance', countLabel = '', cat = 'machine') => ({ key, name, muscle: 'cardio', eq, kind: 'cardio', metric, countLabel, cat })
const O = (key, name, eq = ['bodyweight'], metric = 'distance', countLabel = '') => C(key, name, eq, metric, countLabel, 'outdoor')
const SP = (key, name) => C(key, name, ['bodyweight'], 'effort', '', 'sports')
export const LIBRARY = [
  // chest
  X('bench', 'Barbell bench press', 'chest', ['barbell'], 'chest_lower', ['triceps', 'delt_front']),
  X('incline-bench', 'Incline barbell bench press', 'chest', ['barbell'], 'chest_upper', ['delt_front', 'triceps']),
  X('db-bench', 'Dumbbell bench press', 'chest', ['dumbbell'], 'chest_lower', ['triceps', 'delt_front']),
  X('incline-db', 'Incline dumbbell press', 'chest', ['dumbbell'], 'chest_upper', ['delt_front', 'triceps']),
  X('db-fly', 'Dumbbell fly', 'chest', ['dumbbell'], 'chest_lower'),
  X('cable-fly', 'Cable fly / crossover', 'chest', ['cable'], 'chest_lower'),
  X('chest-press', 'Chest press machine', 'chest', ['machine'], 'chest_lower', ['triceps', 'delt_front']),
  X('incline-cable-fly', 'Low to high cable fly', 'chest', ['cable'], 'chest_upper'),
  X('smith-bench', 'Smith machine bench press', 'chest', ['smith'], 'chest_lower', ['triceps', 'delt_front']),
  X('pushup', 'Push-up', 'chest', ['bodyweight'], 'chest_lower', ['triceps', 'delt_front']),
  X('dips', 'Dips', 'chest', ['dip'], 'chest_lower', ['triceps', 'delt_front']),
  // back
  X('deadlift', 'Deadlift', 'back', ['barbell'], '', ['glutes', 'hamstrings', 'traps']),
  X('bb-row', 'Barbell row', 'back', ['barbell'], '', ['biceps', 'delt_rear']),
  X('db-row', 'One-arm dumbbell row', 'back', ['dumbbell'], 'lats', ['biceps', 'delt_rear']),
  X('tbar-row', 'T-bar row', 'back', ['barbell', 'machine'], '', ['biceps', 'delt_rear']),
  X('pullup', 'Pull-up', 'back', ['pullup'], 'lats', ['biceps']),
  X('chinup', 'Chin-up', 'back', ['pullup'], 'lats', ['biceps']),
  X('lat-pulldown', 'Lat pulldown', 'back', ['cable', 'machine'], 'lats', ['biceps']),
  X('cable-row', 'Seated cable row', 'back', ['cable'], '', ['biceps', 'delt_rear']),
  X('machine-row', 'Machine row', 'back', ['machine'], '', ['biceps', 'delt_rear']),
  X('band-row', 'Band row', 'back', ['bands']),
  X('back-ext', 'Back extension', 'back', ['machine', 'bodyweight'], 'lower_back', ['glutes', 'hamstrings']),
  X('bird-dog', 'Bird dog', 'back', ['bodyweight'], 'lower_back'),
  // traps
  X('bb-shrug', 'Barbell shrug', 'traps', ['barbell'], 'traps_upper'),
  X('db-shrug', 'Dumbbell shrug', 'traps', ['dumbbell'], 'traps_upper'),
  X('cs-row', 'Chest-supported row', 'traps', ['dumbbell', 'machine'], 'traps_mid', ['lats', 'delt_rear']),
  X('prone-t', 'Prone T raise', 'traps', ['dumbbell', 'bodyweight'], 'traps_mid'),
  X('prone-y', 'Prone Y raise', 'traps', ['dumbbell', 'bodyweight'], 'traps_lower'),
  X('scap-pullup', 'Scapular pull-up', 'traps', ['pullup'], 'traps_lower'),
  // shoulders
  X('ohp', 'Overhead press (barbell)', 'shoulders', ['barbell'], 'delt_front', ['triceps', 'traps_upper']),
  X('db-ohp', 'Dumbbell shoulder press', 'shoulders', ['dumbbell'], 'delt_front', ['triceps']),
  X('arnold', 'Arnold press', 'shoulders', ['dumbbell'], 'delt_front', ['delt_side', 'triceps']),
  X('lateral', 'Lateral raise', 'shoulders', ['dumbbell'], 'delt_side'),
  X('cable-lateral', 'Cable lateral raise', 'shoulders', ['cable'], 'delt_side'),
  X('rear-fly', 'Rear delt fly', 'shoulders', ['dumbbell', 'machine'], 'delt_rear'),
  X('face-pull', 'Face pull', 'shoulders', ['cable', 'bands'], 'delt_rear', ['traps_mid']),
  X('shoulder-press-m', 'Shoulder press machine', 'shoulders', ['machine'], 'delt_front', ['triceps']),
  X('pike-pushup', 'Pike push-up', 'shoulders', ['bodyweight'], 'delt_front', ['triceps']),
  X('front-raise', 'Front raise', 'shoulders', ['dumbbell', 'cable'], 'delt_front'),
  X('upright-row', 'Upright row', 'shoulders', ['barbell', 'cable'], 'delt_side', ['traps_upper']),
  X('rev-pec-deck', 'Reverse pec deck', 'shoulders', ['machine'], 'delt_rear'),
  // biceps
  X('bb-curl', 'Barbell curl', 'biceps', ['barbell']),
  X('ez-curl', 'EZ-bar curl', 'biceps', ['ezbar']),
  X('db-curl', 'Dumbbell curl', 'biceps', ['dumbbell']),
  X('hammer', 'Hammer curl', 'biceps', ['dumbbell'], 'bi_long', ['forearms']),
  X('cable-curl', 'Cable curl', 'biceps', ['cable']),
  X('preacher', 'Preacher curl', 'biceps', ['ezbar', 'machine', 'dumbbell'], 'bi_short'),
  X('band-curl', 'Band curl', 'biceps', ['bands']),
  X('incline-curl', 'Incline dumbbell curl', 'biceps', ['dumbbell'], 'bi_long'),
  X('spider-curl', 'Spider curl', 'biceps', ['dumbbell', 'ezbar'], 'bi_short'),
  // triceps
  X('pushdown', 'Triceps pushdown', 'triceps', ['cable'], 'tri_lat'),
  X('oh-ext', 'Overhead triceps extension', 'triceps', ['dumbbell', 'cable'], 'tri_long'),
  X('skull', 'Skull crusher', 'triceps', ['ezbar', 'barbell'], 'tri_long'),
  X('cg-bench', 'Close-grip bench press', 'triceps', ['barbell'], 'tri_lat', ['chest', 'delt_front']),
  X('bench-dip', 'Bench dip', 'triceps', ['bodyweight'], '', ['delt_front']),
  X('rev-pushdown', 'Reverse-grip pushdown', 'triceps', ['cable'], 'tri_med'),
  // forearms
  X('wrist-curl', 'Wrist curl', 'forearms', ['dumbbell', 'barbell'], 'fa_flex'),
  X('farmer', "Farmer's carry", 'forearms', ['dumbbell', 'kettlebell'], 'grip', ['traps_upper', 'core']),
  X('rev-wrist-curl', 'Reverse wrist curl', 'forearms', ['dumbbell', 'barbell'], 'fa_ext'),
  X('dead-hang', 'Dead hang', 'forearms', ['pullup'], 'grip'),
  // quads
  X('squat', 'Back squat', 'quads', ['rack'], '', ['glutes', 'adductors']),
  X('front-squat', 'Front squat', 'quads', ['rack'], '', ['glutes', 'core']),
  X('goblet', 'Goblet squat', 'quads', ['dumbbell', 'kettlebell'], '', ['glutes']),
  X('leg-press', 'Leg press', 'quads', ['legpress'], '', ['glutes']),
  X('hack', 'Hack squat', 'quads', ['machine'], '', ['glutes']),
  X('smith-squat', 'Smith machine squat', 'quads', ['smith'], '', ['glutes']),
  X('leg-ext', 'Leg extension', 'quads', ['machine'], 'quad_rf'),
  X('bulgarian', 'Bulgarian split squat', 'quads', ['dumbbell', 'bodyweight'], '', ['glutes', 'hamstrings']),
  X('lunge', 'Lunge', 'quads', ['dumbbell', 'bodyweight'], '', ['glutes', 'hamstrings']),
  X('bw-squat', 'Bodyweight squat', 'quads', ['bodyweight'], '', ['glutes']),
  X('sissy-squat', 'Sissy squat', 'quads', ['bodyweight'], 'quad_rf'),
  // hamstrings
  X('rdl', 'Romanian deadlift', 'hamstrings', ['barbell', 'dumbbell'], '', ['glute_max', 'lower_back']),
  X('leg-curl', 'Lying leg curl', 'hamstrings', ['machine']),
  X('seated-curl', 'Seated leg curl', 'hamstrings', ['machine']),
  X('good-morning', 'Good morning', 'hamstrings', ['barbell'], '', ['glute_max', 'lower_back']),
  // glutes
  X('hip-thrust', 'Hip thrust', 'glutes', ['barbell', 'dumbbell', 'machine'], 'glute_max', ['hamstrings']),
  X('glute-bridge', 'Glute bridge', 'glutes', ['bodyweight'], 'glute_max', ['hamstrings']),
  X('kickback', 'Cable kickback', 'glutes', ['cable'], 'glute_max'),
  X('band-walk', 'Banded side walk', 'glutes', ['bands'], 'glute_med'),
  X('cable-abduction', 'Cable hip abduction', 'glutes', ['cable', 'machine'], 'glute_med'),
  X('side-leg-raise', 'Side-lying leg raise', 'glutes', ['bodyweight'], 'glute_med'),
  // inner thigh
  X('copenhagen', 'Copenhagen plank', 'adductors', ['bodyweight']),
  X('adductor-machine', 'Adductor machine', 'adductors', ['machine']),
  X('sumo-squat', 'Sumo squat', 'adductors', ['dumbbell', 'kettlebell'], '', ['glutes', 'quads']),
  // calves
  X('calf-raise', 'Standing calf raise', 'calves', ['machine', 'dumbbell', 'bodyweight', 'smith'], 'gastroc'),
  X('seated-calf', 'Seated calf raise', 'calves', ['machine'], 'soleus'),
  // shins and feet
  X('tib-raise', 'Tibialis raise', 'shins', ['bodyweight']),
  X('heel-walk', 'Heel walk', 'shins', ['bodyweight']),
  X('towel-scrunch', 'Towel scrunch', 'feet', ['bodyweight']),
  X('single-leg-balance', 'Single-leg balance', 'feet', ['bodyweight']),
  // core
  X('plank', 'Plank (reps = seconds)', 'core', ['bodyweight']),
  X('crunch', 'Crunch', 'core', ['bodyweight'], 'abs_upper'),
  X('hanging-raise', 'Hanging leg raise', 'core', ['pullup'], 'abs_lower', ['grip']),
  X('cable-crunch', 'Cable crunch', 'core', ['cable'], 'abs_upper'),
  X('russian-twist', 'Russian twist', 'core', ['bodyweight', 'dumbbell', 'kettlebell'], 'obliques'),
  X('ab-wheel', 'Ab wheel rollout', 'core', ['abwheel']),
  X('rev-crunch', 'Reverse crunch', 'core', ['bodyweight'], 'abs_lower'),
  X('side-plank', 'Side plank (reps = seconds)', 'core', ['bodyweight'], 'obliques'),
  X('pallof', 'Pallof press', 'core', ['cable', 'bands'], 'obliques'),
  // neck
  X('neck-iso', 'Neck isometric hold (reps = seconds)', 'neck', ['bodyweight']),
  X('plate-neck-curl', 'Plate neck curl', 'neck', ['barbell']),
  // full body
  X('kb-swing', 'Kettlebell swing', 'fullbody', ['kettlebell'], '', ['glutes', 'hamstrings']),
  X('clean-press', 'Clean and press', 'fullbody', ['barbell', 'dumbbell', 'kettlebell']),
  X('burpee', 'Burpee', 'fullbody', ['bodyweight']),
  // cardio machines (gym)
  C('treadmill-run', 'Treadmill', ['treadmill']),
  C('bike', 'Stationary bike', ['bike']),
  C('row', 'Rowing machine', ['rower']),
  C('elliptical', 'Elliptical', ['elliptical']),
  C('stair-climber', 'Stair climber', ['stairs'], 'time', 'floors'),
  C('skipping', 'Skipping (jump rope)', ['jumprope'], 'time', 'jumps'),
  // outdoor (phase 5.12.1 groups them; old keys unchanged, so history stays)
  O('run', 'Running (outdoor)'),
  O('walk', 'Walking'),
  O('cycle', 'Cycling (outdoor)', ['bicycle']),
  O('swim', 'Swimming', ['pool']),
  O('hike', 'Hiking'),
  O('trek', 'Trekking'),
  O('stairs-outdoor', 'Climbing stairs (outdoor)', ['bodyweight'], 'time', 'floors'),
  // sports and activities (phase 5.12.1): time and effort
  SP('cricket', 'Cricket'),
  SP('badminton', 'Badminton'),
  SP('football', 'Football'),
  SP('tennis', 'Tennis'),
  SP('table-tennis', 'Table tennis'),
  SP('basketball', 'Basketball'),
  SP('volleyball', 'Volleyball'),
  SP('kabaddi', 'Kabaddi'),
  SP('squash', 'Squash'),
  SP('pickleball', 'Pickleball'),
  SP('hockey', 'Hockey'),
  SP('yoga', 'Yoga'),
  SP('dance', 'Dance'),
  SP('martial-arts', 'Martial arts'),
  SP('climbing', 'Climbing / bouldering'),
  SP('skating', 'Skating'),
]

// Picker groups (phase 5.12.1): gym exercises and three kinds of cardio.
export const EXERCISE_CATS = [
  { key: 'gym', label: 'Gym' },
  { key: 'machine', label: 'Cardio machines' },
  { key: 'outdoor', label: 'Outdoor' },
  { key: 'sports', label: 'Sports' },
]
export const EFFORTS = [
  { key: 'easy', label: 'Easy' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'hard', label: 'Hard' },
]

export const isCardio = (ex) => ex?.kind === 'cardio' || ex?.muscle === 'cardio'
const KNOWN = Object.fromEntries(LIBRARY.map((x) => [x.key, x]))
/** Cardio metric for an exercise ('distance', 'time' or 'effort'), looking up built-in ones by key. */
export const cardioMetric = (ex) => KNOWN[ex.key]?.metric || ex.metric || 'distance'
export const countLabel = (ex) => KNOWN[ex.key]?.countLabel || ex.countLabel || ''
/** Which picker group an exercise is in: 'gym', 'machine', 'outdoor' or 'sports'. */
export const exerciseCat = (ex) => (!isCardio(ex) ? 'gym' : KNOWN[ex.key]?.cat || ex.cat || 'outdoor')
/** FitPot's own version of a built-in exercise (for "Reset to FitPot's version"). */
export const builtIn = (key) => KNOWN[key] || null
/** The other muscles an exercise works: saved on it, else FitPot's list. */
export const alsoOf = (ex) => (Array.isArray(ex?.also) ? ex.also : KNOWN[ex?.key]?.also || [])
/** "Glute max, Lower back" for a list of group or part keys. */
export const alsoText = (also = []) => also.map((k) => partLabel(k) || muscleLabel(k)).join(', ')

/**
 * Library + your own exercises (custom ones keep their Firestore id as key).
 * `edits` (phase 5.12.1): your changes to built-in exercises by key, from
 * settings/training.edits. The key never changes, so history and records stay.
 */
export function allExercises(custom = [], edits = {}) {
  const lib = LIBRARY.map((x) => (edits[x.key] ? { ...x, ...edits[x.key], key: x.key, edited: true } : x))
  return [...lib, ...custom.map((c) => ({
    key: `my:${c.id}`, name: c.name, muscle: c.muscle || 'fullbody', ...(c.part ? { part: c.part } : {}), ...(c.also?.length ? { also: c.also } : {}),
    eq: c.eq?.length ? c.eq : ['bodyweight'], custom: true, id: c.id,
    ...(c.muscle === 'cardio' ? { kind: 'cardio', metric: c.metric || 'distance', countLabel: c.countLabel || '', cat: c.cat || 'outdoor' } : {}),
  }))]
}

/** Can you do this exercise with the equipment you have? */
export const doable = (ex, have) => ex.eq.some((e) => e === 'bodyweight' || have.has(e))

// ---------- numbers ----------
const r1 = (x) => Math.round(x * 10) / 10

/** Estimated 1-rep max (Epley). Lets 8 × 60 kg and 3 × 70 kg be compared. */
export function e1rm(kg, reps) {
  if (!(kg > 0) || !(reps > 0)) return 0
  return reps === 1 ? kg : kg * (1 + reps / 30)
}

const realSets = (ex) => (isCardio(ex) ? [] : (ex.sets || []).filter((s) => Number(s.reps) > 0))

// ---------- cardio ----------
const cardioSets = (ex) => (isCardio(ex) ? (ex.sets || []).filter((s) => Number(s.km) > 0 || Number(s.min) > 0) : [])
/** Minutes per km, or 0 if it can't be worked out. */
export const pace = (km, min) => (km > 0 && min > 0 ? min / km : 0)
// Pace only counts as a record over a sensible distance (swims are shorter).
const paceMinKm = (key) => (key === 'swim' ? 0.2 : 1)

/** One cardio session's totals. */
function cardioTotals(ex) {
  const sets = cardioSets(ex)
  if (!sets.length) return null
  const km = sets.reduce((a, s) => a + (Number(s.km) || 0), 0)
  const min = sets.reduce((a, s) => a + (Number(s.min) || 0), 0)
  const count = sets.reduce((a, s) => a + (Number(s.count) || 0), 0)
  // Sports: the hardest effort in the session (phase 5.12.1).
  const effort = ['hard', 'moderate', 'easy'].find((e) => sets.some((s) => s.effort === e)) || ''
  return { km: r2(km), min: r1(min), count, pace: pace(km, min), ...(effort ? { effort } : {}) }
}
const r2 = (x) => Math.round(x * 100) / 100

/** Every session of one cardio exercise, oldest first. */
export function cardioHistory(workouts, key) {
  const out = []
  for (const w of [...workouts].sort(byDate)) {
    for (const ex of w.exercises || []) {
      if (ex.key !== key || !isCardio(ex)) continue
      const t = cardioTotals(ex)
      if (t) out.push({ workoutId: w.id, date: w.date, ...t, note: ex.note || '' })
    }
  }
  return out
}

/** The most recent earlier cardio session (for "last time"). */
export function lastCardio(workouts, key, { before, excludeId } = {}) {
  const h = cardioHistory(workouts.filter((w) => w.id !== excludeId && (!before || w.date <= before)), key)
  return h[h.length - 1] || null
}

/** Best set of an exercise in one session: highest e1RM, or most reps for bodyweight. */
export function bestSet(sets) {
  let best = null
  for (const s of sets) {
    const reps = Number(s.reps) || 0, kg = Number(s.kg) || 0
    if (!reps) continue
    const score = kg > 0 ? e1rm(kg, reps) : 0
    if (!best || score > best.e1rm || (score === best.e1rm && reps > best.reps)) best = { reps, kg, e1rm: r1(score) }
  }
  return best
}

/** Every session of one exercise, oldest first. */
export function historyOf(workouts, key) {
  const out = []
  for (const w of [...workouts].sort(byDate)) {
    for (const ex of w.exercises || []) {
      if (ex.key !== key) continue
      const sets = realSets(ex)
      if (!sets.length) continue
      out.push({
        workoutId: w.id, date: w.date, sets, best: bestSet(sets), note: ex.note || '',
        maxKg: Math.max(...sets.map((s) => Number(s.kg) || 0)),
        maxReps: Math.max(...sets.map((s) => Number(s.reps) || 0)),
        volume: sets.reduce((v, s) => v + (Number(s.reps) || 0) * (Number(s.kg) || 0), 0),
      })
    }
  }
  return out
}

function byDate(a, b) {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdMs || 0) - (b.createdMs || 0)
}

/** The most recent earlier session of an exercise (to show "last time"). */
export function lastTime(workouts, key, { before, excludeId } = {}) {
  const h = historyOf(workouts.filter((w) => w.id !== excludeId && (!before || w.date <= before)), key)
  return h[h.length - 1] || null
}

/**
 * Personal records, walking every workout in date order.
 * Returns {
 *   byWorkout: { workoutId: [{ key, name, kind: 'weight'|'e1rm'|'reps', value, reps?, kg? }] },
 *   records:   { key: { name, muscle, heaviest:{kg,reps,date}, bestE1rm:{value,kg,reps,date}, mostReps:{reps,kg,date}, sessions, lastDate } }
 * }
 * A first-ever session sets the baseline; PRs are counted when you beat it.
 */
export function personalRecords(workouts) {
  const records = {}, byWorkout = {}
  for (const w of [...workouts].sort(byDate)) {
    for (const ex of w.exercises || []) {
      if (isCardio(ex)) { cardioRecord(records, byWorkout, w, ex); continue }
      const sets = realSets(ex)
      if (!sets.length) continue
      const r = records[ex.key]
      const best = bestSet(sets)
      const heavy = sets.reduce((a, s) => ((Number(s.kg) || 0) > a.kg || ((Number(s.kg) || 0) === a.kg && (Number(s.reps) || 0) > a.reps) ? { kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 } : a), { kg: -1, reps: 0 })
      const reps = sets.reduce((a, s) => ((Number(s.reps) || 0) > a.reps ? { reps: Number(s.reps) || 0, kg: Number(s.kg) || 0 } : a), { reps: 0, kg: 0 })
      if (!r) {
        records[ex.key] = {
          name: ex.name, muscle: ex.muscle, sessions: 1, lastDate: w.date,
          heaviest: { ...heavy, date: w.date },
          bestE1rm: { value: best.e1rm, kg: best.kg, reps: best.reps, date: w.date },
          mostReps: { ...reps, date: w.date },
        }
        continue
      }
      const prs = []
      if (heavy.kg > r.heaviest.kg) { prs.push({ kind: 'weight', value: heavy.kg, reps: heavy.reps }); r.heaviest = { ...heavy, date: w.date } }
      if (best.e1rm > r.bestE1rm.value + 0.05) { prs.push({ kind: 'e1rm', value: best.e1rm, kg: best.kg, reps: best.reps }); r.bestE1rm = { value: best.e1rm, kg: best.kg, reps: best.reps, date: w.date } }
      if (reps.reps > r.mostReps.reps) { prs.push({ kind: 'reps', value: reps.reps, kg: reps.kg }); r.mostReps = { ...reps, date: w.date } }
      r.sessions++; r.lastDate = w.date; r.name = ex.name
      if (prs.length) (byWorkout[w.id] ||= []).push(...prs.map((p) => ({ key: ex.key, name: ex.name, ...p })))
    }
  }
  return { records, byWorkout }
}

// Cardio records: longest distance, best pace (over a sensible distance),
// longest time, highest count (floors, jumps).
function cardioRecord(records, byWorkout, w, ex) {
  const t = cardioTotals(ex)
  if (!t) return
  const paceOk = t.pace && t.km >= paceMinKm(ex.key)
  const r = records[ex.key]
  if (!r) {
    records[ex.key] = {
      name: ex.name, muscle: 'cardio', cardio: true, metric: cardioMetric(ex), countLabel: countLabel(ex), sessions: 1, lastDate: w.date,
      longest: { km: t.km, date: w.date },
      bestPace: paceOk ? { pace: t.pace, km: t.km, date: w.date } : null,
      longestTime: { min: t.min, date: w.date },
      mostCount: { count: t.count, date: w.date },
    }
    return
  }
  const prs = []
  if (t.km > r.longest.km) { prs.push({ kind: 'distance', value: t.km }); r.longest = { km: t.km, date: w.date } }
  if (paceOk && (!r.bestPace || t.pace < r.bestPace.pace - 0.001)) {
    if (r.bestPace) prs.push({ kind: 'pace', value: t.pace, km: t.km })
    r.bestPace = { pace: t.pace, km: t.km, date: w.date }
  }
  if (t.min > r.longestTime.min) { prs.push({ kind: 'time', value: t.min }); r.longestTime = { min: t.min, date: w.date } }
  if (t.count > r.mostCount.count) { if (r.mostCount.count) prs.push({ kind: 'count', value: t.count }); r.mostCount = { count: t.count, date: w.date } }
  r.sessions++; r.lastDate = w.date; r.name = ex.name
  if (prs.length) (byWorkout[w.id] ||= []).push(...prs.map((p) => ({ key: ex.key, name: ex.name, ...p })))
}

/**
 * One week (Mon to Sun containing `day`) per muscle group, compared with the week before.
 * Returns { mon, sun, sessions, prevSessions, muscles: [{ muscle, sets, prevSets, volume, prevVolume,
 *   exercises: [{ key, name, best, prevBest, trend: 'up'|'down'|'same'|'new' }] }] }
 */
export function weekByMuscle(workouts, day) {
  const mon = mondayOf(day), sun = addDays(mon, 6)
  const pmon = addDays(mon, -7), psun = addDays(mon, -1)
  const inRange = (a, b) => workouts.filter((w) => w.date >= a && w.date <= b)
  const thisW = inRange(mon, sun), prevW = inRange(pmon, psun)

  function tally(list) {
    const m = {}
    for (const w of list) for (const ex of w.exercises || []) {
      const sets = realSets(ex)
      if (!sets.length) continue
      const t = (m[ex.muscle || 'fullbody'] ||= { sets: 0, volume: 0, ex: {} })
      t.sets += sets.length
      t.volume += sets.reduce((v, s) => v + (Number(s.reps) || 0) * (Number(s.kg) || 0), 0)
      const e = (t.ex[ex.key] ||= { name: ex.name, sets: [] })
      e.sets.push(...sets)
      // Muscles it also works get half a set each (phase 5.12.1).
      for (const g of alsoGroups(ex)) (m[g] ||= { sets: 0, volume: 0, ex: {} }).sets += sets.length / 2
    }
    return m
  }
  const a = tally(thisW), b = tally(prevW)

  // Cardio: distance and time per activity, this week vs last week.
  function cardioTally(list) {
    const m = {}
    for (const w of list) for (const ex of w.exercises || []) {
      const t = isCardio(ex) && cardioTotals(ex)
      if (!t) continue
      const e = (m[ex.key] ||= { name: ex.name, metric: cardioMetric(ex), countLabel: countLabel(ex), km: 0, min: 0, count: 0, sessions: 0 })
      e.km += t.km; e.min += t.min; e.count += t.count; e.sessions++
    }
    return m
  }
  const ca = cardioTally(thisW), cb = cardioTally(prevW)
  const cKeys = [...new Set([...Object.keys(ca), ...Object.keys(cb)])]
  const sum = (m, k) => r2(Object.values(m).reduce((x, e) => x + e[k], 0))
  const cardio = cKeys.length ? {
    km: sum(ca, 'km'), prevKm: sum(cb, 'km'), min: sum(ca, 'min'), prevMin: sum(cb, 'min'),
    exercises: cKeys.map((key) => {
      const cur = ca[key], prev = cb[key]
      const metric = (ca[key] || cb[key]).metric || cardioMetric({ key })
      const v = (e) => (e ? (metric === 'time' ? e.min : e.km || e.min) : 0)
      const trend = !cur ? 'none' : !prev ? 'new' : v(cur) > v(prev) ? 'up' : v(cur) < v(prev) ? 'down' : 'same'
      return { key, name: (cur || prev).name, metric, countLabel: (cur || prev).countLabel, cur: cur || null, prev: prev || null, trend }
    }),
  } : null
  const muscles = MUSCLES.map((mm) => mm.key).filter((k) => a[k] || b[k]).map((k) => {
    const cur = a[k] || { sets: 0, volume: 0, ex: {} }, prev = b[k] || { sets: 0, volume: 0, ex: {} }
    const keys = [...new Set([...Object.keys(cur.ex), ...Object.keys(prev.ex)])]
    const exercises = keys.map((key) => {
      const best = cur.ex[key] ? bestSet(cur.ex[key].sets) : null
      const prevBest = prev.ex[key] ? bestSet(prev.ex[key].sets) : null
      return { key, name: (cur.ex[key] || prev.ex[key]).name, best, prevBest, trend: compare(best, prevBest) }
    })
    return { muscle: k, sets: r1(cur.sets), prevSets: r1(prev.sets), volume: Math.round(cur.volume), prevVolume: Math.round(prev.volume), exercises }
  })
  return { mon, sun, sessions: thisW.length, prevSessions: prevW.length, muscles, cardio }
}

/**
 * Sets per body map region between two dates (inclusive), for the muscle map.
 * A set tagged with a part counts for that part. A set with only a group
 * counts for every part of that group, since it works the whole group.
 */
export function setsByRegion(workouts, from, to) {
  const out = {}
  for (const w of workouts) {
    if (w.date < from || w.date > to) continue
    for (const ex of w.exercises || []) {
      const n = realSets(ex).length
      if (!n) continue
      const regions = ex.part && PART_INFO[ex.part] ? [ex.part] : regionsOf(ex.muscle)
      for (const r of regions) out[r] = (out[r] || 0) + n
      // Also-muscles: half a set to each of their regions (phase 5.12.1).
      for (const k of alsoOf(ex)) for (const r of (PART_INFO[k] ? [k] : regionsOf(k))) out[r] = (out[r] || 0) + n / 2
    }
  }
  return out
}

/** Muscle groups trained in the 3 weeks before `mon` but not yet from `mon` to `to`. */
export function quietMuscles(workouts, mon, to) {
  const before = new Set(), now = new Set()
  const from = addDays(mon, -21)
  for (const w of workouts) {
    if (w.date < from || w.date > to) continue
    for (const ex of w.exercises || []) {
      if (!realSets(ex).length || !regionsOf(ex.muscle).length) continue
      ;(w.date >= mon ? now : before).add(ex.muscle)
      if (w.date >= mon) for (const g of alsoGroups(ex)) now.add(g)
    }
  }
  return MUSCLES.filter((m) => before.has(m.key) && !now.has(m.key)).map((m) => m.key)
}

/** Muscle groups of an exercise's also-muscles, other than its own group. */
function alsoGroups(ex) {
  return [...new Set(alsoOf(ex).map((k) => muscleOfPart(k) || k))].filter((g) => g !== ex.muscle && MUSCLES.some((m) => m.key === g))
}

function compare(best, prev) {
  if (!best) return 'none'
  if (!prev) return 'new'
  const a = best.e1rm || 0, b = prev.e1rm || 0
  if (a || b) return a > b + 0.05 ? 'up' : a < b - 0.05 ? 'down' : best.reps > prev.reps ? 'up' : best.reps < prev.reps ? 'down' : 'same'
  return best.reps > prev.reps ? 'up' : best.reps < prev.reps ? 'down' : 'same'
}

/** A simple target to beat last time (double progression): one more rep, and
 *  once you reach the top of the rep range, a bit more weight. Returns { kg, reps } or null. */
export function beatIt(last, { repTop = 12, stepKg = 2.5 } = {}) {
  if (!last?.best) return null
  const { kg, reps } = last.best
  if (!kg) return { kg: 0, reps: reps + 1 }
  return reps >= repTop ? { kg: r1(kg + stepKg), reps: Math.max(6, repTop - 4) } : { kg, reps: reps + 1 }
}

/** Display helpers. Weights are stored in kg, distances in km. */
export const KM_PER_MI = 1.609344
export function units(unit = 'kg', dist = 'km') {
  const LB = 2.20462
  const toDisp = (kg) => (kg ? Math.round((unit === 'lb' ? kg * LB : kg) * 10) / 10 : 0)
  const toKg = (v) => { const n = Number(v) || 0; return unit === 'lb' ? n / LB : n }
  const show = (kg, reps) => (kg ? `${toDisp(kg)} ${unit} × ${reps}` : `${reps} reps`)
  const toDist = (km) => (km ? Math.round((dist === 'mi' ? km / KM_PER_MI : km) * 100) / 100 : 0)
  const toKm = (v) => { const n = Number(v) || 0; return dist === 'mi' ? n * KM_PER_MI : n }
  /** "5:36 /km" from minutes per km. */
  const showPace = (minPerKm) => {
    if (!minPerKm) return ''
    const per = dist === 'mi' ? minPerKm * KM_PER_MI : minPerKm
    const m = Math.floor(per), sec = Math.round((per - m) * 60)
    return `${sec === 60 ? m + 1 : m}:${String(sec === 60 ? 0 : sec).padStart(2, '0')} /${dist}`
  }
  const showCardio = (t, metric = 'distance', countLbl = '') => [
    t.km ? `${toDist(t.km)} ${dist}` : '',
    t.min ? `${t.min} min` : '',
    metric === 'effort' && t.effort ? t.effort : '',
    metric === 'time' && t.count ? `${t.count} ${countLbl}` : '',
    t.km && t.min ? showPace(pace(t.km, t.min)) : '',
  ].filter(Boolean).join(', ')
  return { unit, dist, toDisp, toKg, show, toDist, toKm, showPace, showCardio, step: unit === 'lb' ? 5 : 2.5 }
}
