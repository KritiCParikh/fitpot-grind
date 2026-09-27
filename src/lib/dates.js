// Date helpers. Every "day" in FitPot is a YYYY-MM-DD string in the GROUP's
// timezone, so a check-in at 11:30 PM counts for the same day for everyone.

export function dayInTz(date, timeZone) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

export const todayInTz = (timeZone) => dayInTz(new Date(), timeZone)

// Pure calendar arithmetic on YYYY-MM-DD strings (no timezone involved).
export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

export function monthDays(year, month /* 0-11 */) {
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const pad = (n) => String(n).padStart(2, '0')
  return Array.from({ length: count }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`)
}

export function weekdayOf(day) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
}

export function prettyDay(day) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

// Current streak: consecutive checked-in days ending today (or yesterday,
// if today isn't done yet — the streak isn't broken until midnight).
export function currentStreak(doneDays /* Set of YYYY-MM-DD */, today) {
  let day = doneDays.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (doneDays.has(day)) { streak++; day = addDays(day, -1) }
  return streak
}

export function bestStreak(doneDays) {
  const sorted = [...doneDays].sort()
  let best = 0, run = 0, prev = null
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

// Monday of the week containing `day` (weeks run Monday → Sunday).
export function mondayOf(day) {
  return addDays(day, -((weekdayOf(day) + 6) % 7))
}
