// Calorie calculator (phase 5.11). Pure logic, no network: everything is
// worked out on the phone. A starting point for people learning to count
// calories, not medical advice.
//
// Resting burn uses the Mifflin-St Jeor equation, the one most calorie
// calculators use:
//   men:   10 x weight kg + 6.25 x height cm - 5 x age + 5
//   women: 10 x weight kg + 6.25 x height cm - 5 x age - 161
// Daily burn = resting burn x activity level.

export const ACTIVITY = [
  { key: 'sitting', label: 'Mostly sitting', note: 'desk job, little exercise', factor: 1.2 },
  { key: 'light', label: 'Lightly active', note: '1 to 3 workouts a week', factor: 1.375 },
  { key: 'moderate', label: 'Active', note: '3 to 5 workouts a week', factor: 1.55 },
  { key: 'very', label: 'Very active', note: '6 to 7 workouts a week', factor: 1.725 },
  { key: 'athlete', label: 'Athlete or physical job', note: 'training twice a day, or on your feet all day', factor: 1.9 },
]

// Kept gentle on purpose: about half a kilo a week at most.
export const GOALS = [
  { key: 'lose', label: 'Lose about 0.5 kg a week', delta: -500 },
  { key: 'loseSlow', label: 'Lose slowly, about 0.25 kg a week', delta: -250 },
  { key: 'maintain', label: 'Stay where I am', delta: 0 },
  { key: 'gainSlow', label: 'Gain slowly, about 0.25 kg a week', delta: 250 },
]

// Calories in one gram of each.
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9, alcohol: 7 }

const round = (x, to = 1) => Math.round(x / to) * to

/**
 * { age, sex: 'male' | 'female', heightCm, weightKg, activity, goal }
 * -> { bmr, maintenance, target, floored, protein, carbs, fat, fibre } or null
 */
export function calculate({ age, sex, heightCm, weightKg, activity, goal }) {
  const a = Number(age), h = Number(heightCm), w = Number(weightKg)
  if (!(a >= 18 && a <= 100 && h >= 100 && h <= 250 && w >= 25 && w <= 300) || !sex) return null
  const bmr = 10 * w + 6.25 * h - 5 * a + (sex === 'male' ? 5 : -161)
  const factor = ACTIVITY.find((x) => x.key === activity)?.factor || 1.2
  const maintenance = bmr * factor
  const delta = GOALS.find((x) => x.key === goal)?.delta || 0
  // Never suggest eating below your resting burn or a common safe floor.
  const floor = Math.max(bmr, sex === 'male' ? 1500 : 1200)
  const wanted = maintenance + delta
  const target = Math.max(wanted, Math.min(floor, maintenance))
  const floored = target > wanted
  // Protein about 1.6 g per kg for people who train, fat about a quarter of
  // calories, fibre about 14 g per 1,000 kcal, carbs make up the rest.
  const protein = round(w * 1.6)
  const fat = round((target * 0.25) / KCAL_PER_G.fat)
  const carbs = Math.max(0, round((target - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs))
  const fibre = round((target / 1000) * 14)
  return { bmr: round(bmr, 10), maintenance: round(maintenance, 10), target: round(target, 10), floored, protein, carbs, fat, fibre }
}

/** Calories in a food from its protein, carbs and fat (grams). */
export const kcalFrom = ({ protein = 0, carbs = 0, fat = 0 }) => protein * 4 + carbs * 4 + fat * 9
