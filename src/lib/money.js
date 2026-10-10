// Pot currency. Each group has one currency at a time (₹ / $ / £ / C$).
//
// Changing it is logged in groups/{id}/currencies together with:
//   • the exchange rate on the day of the change (1 old = rate new),
//     fetched from a free public source and editable before saving
//   • the new penalty in the new currency
// Both take effect tomorrow. From then on EVERY amount, including all past
// months, is shown in the new currency, converted at the saved rate.
// Several changes chain: ₹ → $ → £ multiplies the two saved rates.

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian rupee', locale: 'en-IN', defaultPenalty: 100 },
  { code: 'USD', symbol: '$', name: 'US dollar', locale: 'en-US', defaultPenalty: 5 },
  { code: 'GBP', symbol: '£', name: 'British pound', locale: 'en-GB', defaultPenalty: 5 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian dollar', locale: 'en-CA', defaultPenalty: 5 },
]
export const CODES = CURRENCIES.map((c) => c.code)
export const currencyInfo = (code) => CURRENCIES.find((c) => c.code === code) || CURRENCIES[1]
export const MAX_PENALTY = 100000

/** A sensible default for a new group, from the phone's timezone. */
export function guessCurrency(timeZone = '') {
  if (/^Asia\/(Kolkata|Calcutta)$/.test(timeZone)) return 'INR'
  if (/^Europe\/(London|Belfast)$/.test(timeZone)) return 'GBP'
  if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal)$/.test(timeZone)) return 'CAD'
  return 'USD'
}

/**
 * Format an amount. digits: decimal places. plus: show "+" for gains.
 * e.g. fmt(-1234.5, 'INR') → "−₹1,234.50", fmt(3, 'USD', { digits: 0 }) → "$3"
 */
export function fmt(amount, code, { digits = 2, plus = false } = {}) {
  const c = currencyInfo(code)
  const x = Number(amount) || 0
  const sign = x < -0.004 ? '−' : plus && x > 0.004 ? '+' : ''
  const num = Math.abs(x).toLocaleString(c.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${sign}${c.symbol}${num}`
}

/** Penalty amounts are whole numbers in INR, cents elsewhere. */
export function roundPenalty(x, code) {
  return code === 'INR' ? Math.round(x) : Math.round(x * 100) / 100
}

/** Today's rate: 1 `from` = ? `to`. Tries two free, key-less sources. */
export async function fetchRate(from, to) {
  if (from === to) return 1
  const sources = [
    async () => {
      const r = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`)
      return (await r.json()).rates?.[to]
    },
    async () => {
      const f = from.toLowerCase()
      const r = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${f}.min.json`)
      return (await r.json())[f]?.[to.toLowerCase()]
    },
  ]
  for (const get of sources) {
    try { const rate = Number(await get()); if (rate > 0) return rate } catch { /* try the next one */ }
  }
  throw new Error('Couldn\'t fetch today\'s rate. Type it in instead.')
}

/**
 * base:    the group's starting currency
 * changes: valid currency changes, sorted (from validChanges)
 * today:   () => the viewer's today
 */
export function makeMoney({ base = 'USD', changes = [], today }) {
  const applied = () => changes.filter((c) => c.effectiveDate <= today())
  function currencyOn(day) {
    let cur = base
    for (const c of changes) if (c.effectiveDate <= day) cur = c.currency
    return cur
  }
  return {
    changes,
    currencyOn,
    /** The currency shown right now. */
    current: () => currencyOn(today()),
    /** Multiply an amount from `day`'s currency by this to show it in today's currency. */
    factorOn(day) {
      let f = 1
      for (const c of applied()) if (c.effectiveDate > day) f *= c.rate
      return f
    },
    /** Changes already in force, for "converted at..." notes. */
    applied,
    pending: () => changes.filter((c) => c.effectiveDate > today()),
    fmt: (x, opts) => fmt(x, currencyOn(today()), opts),
  }
}
