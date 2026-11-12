// Who gets which reminder this run (phase 5.8). Pure functions, so they're
// tested without Firebase. The hourly job feeds them each person's settings.

export const SLOTS = [
  { key: 'morning', label: 'Morning', time: '08:00' },
  { key: 'afternoon', label: 'Afternoon', time: '13:00' },
  { key: 'evening', label: 'Evening', time: '19:00' },
]

// GitHub's hourly runs can be late or skipped now and then, so a reminder is
// due for up to 100 minutes after its time (and never sent twice a day).
const WINDOW_MIN = 100

/** Local date (YYYY-MM-DD) and minutes since midnight in a timezone. */
export function localNow(now, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return (h || 0) * 60 + (m || 0) }

/**
 * settings: { on, tz, slots: { morning: { on, time }, ... }, lastSent: { morning: 'YYYY-MM-DD' } }
 * Returns the one slot due now ({ key, date }) or null.
 */
export function dueSlot(settings, now) {
  if (!settings?.on || !settings.tz) return null
  const { date, minutes } = localNow(now, settings.tz)
  let due = null
  for (const s of SLOTS) {
    const conf = { on: true, time: s.time, ...(settings.slots?.[s.key] || {}) }
    if (!conf.on || settings.lastSent?.[s.key] === date) continue
    const since = minutes - toMin(conf.time)
    if (since >= 0 && since < WINDOW_MIN) due = { key: s.key, date } // the latest due slot wins
  }
  return due
}

/**
 * What to send for a due slot, given today's situation.
 * day: { checkedIn, rest, inGroup }
 * Returns 'morning' | 'afternoon' | 'evening' | 'done' | 'rest' | 'solo' | null (send nothing).
 */
export function messageKind(slotKey, day) {
  if (!day.inGroup) return slotKey === 'afternoon' ? null : 'solo' // personal only: two a day
  if (day.checkedIn) return slotKey === 'evening' ? 'done' : null   // no nudges once you're in
  if (day.rest) return slotKey === 'evening' ? 'rest' : null        // rest day: one kind note
  return slotKey
}

/** Day number since 1970, to rotate messages. */
export const dayIndex = (date) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000)

// ---------- Crew chat (phase 5.16) ----------

/** Quiet hours for chat notes: 10 pm to 7 am, your time. */
export const chatQuiet = (minutes) => minutes >= 22 * 60 || minutes < 7 * 60

/** One kind line for the newest message. Amounts are never in chat, so never here. */
export function chatPreview(m, uid) {
  const who = m.name || 'Someone'
  const cut = (t, n = 80) => (t.length > n ? `${t.slice(0, n - 1)}...` : t)
  switch (m.kind) {
    case 'text': return `${who}: ${cut(m.text || '')}`
    case 'cheer': return m.to === uid ? `${who} cheered you on: ${m.cheer}` : `${who}: ${m.cheer}`
    case 'invite': return `${who} invited the crew to train together${m.invite?.part ? ` (${m.invite.part})` : ''}. Are you in?`
    case 'card': return `${who} shared a workout. Send some love.`
    case 'routine': return `${who} shared a routine: ${m.routine?.name || 'have a look'}`
    case 'settle': return `${who} and ${m.settle?.other === uid ? 'you' : m.settle?.otherName || 'a friend'} are all square.`
    default: return `${who} wrote in your crew chat`
  }
}
