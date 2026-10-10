import { useEffect, useState } from 'react'
import { useReminders } from '../lib/privateData'
import {
  blocker, enableReminders, disableReminders, saveReminderSlots, refreshReminders, testReminder, DEFAULT_SLOTS,
} from '../lib/reminders'

const SLOT_LABELS = [['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']]

// Account, Reminders: kind daily reminders, three a day in your own time.
// After you check in, the rest of the day's nudges stop and you get one
// "nice work" note in the evening. Rest days get one gentle note.
export default function RemindersCard({ user }) {
  const settings = useReminders(user.uid)
  const [why, setWhy] = useState(null) // null while checking, '' when OK
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { blocker().then(setWhy) }, [])
  useEffect(() => { if (settings?.on) refreshReminders(user.uid, settings).catch(() => {}) }, [user.uid, settings])

  if (settings === undefined || why === null) return <div className="card"><p className="muted small">Loading...</p></div>
  const on = Boolean(settings?.on)
  const slots = { ...DEFAULT_SLOTS, ...settings?.slots }

  async function act(fn, done = '') {
    setBusy(true); setMsg('')
    try { await fn(); if (done) setMsg(done) } catch (e) { setMsg(e.message || String(e)) } finally { setBusy(false) }
  }
  const setSlot = (key, patch) => saveReminderSlots(user.uid, { ...slots, [key]: { ...slots[key], ...patch } })

  return (
    <div className="card form reminders-card">
      <p><strong>Daily reminders</strong></p>
      <p className="muted small">Three friendly nudges a day, in your own time. Once you've checked in, the nudges stop and you get one kind note in the evening. Rest days get a gentle note only.</p>

      {why === 'setup' && <p className="muted small">Reminders aren't switched on for this app yet. The organiser needs to add the push key (BUILD_GUIDE, Phase 5.8).</p>}
      {why === 'ios-install' && <p className="muted small">On iPhone, reminders work once FitPot is on your Home Screen: open it in Safari, tap Share, then Add to Home Screen. Then open FitPot from the icon and come back here.</p>}
      {why === 'unsupported' && <p className="muted small">This browser can't show notifications. On Android use Chrome; on iPhone add FitPot to your Home Screen first (iOS 16.4 or newer).</p>}
      {why === 'denied' && <p className="muted small">Notifications are blocked for FitPot. Allow them in your phone's settings (or the browser's site settings), then reopen the app.</p>}

      {!why && (
        <>
          <label className="check">
            <input type="checkbox" checked={on} disabled={busy} onChange={(e) => act(
              () => (e.target.checked ? enableReminders(user.uid, settings) : disableReminders(user.uid)),
              e.target.checked ? 'Reminders are on.' : 'Reminders are off.',
            )} />
            Send me reminders on this phone
          </label>
          {on && (
            <>
              <div className="slot-list">
                {SLOT_LABELS.map(([key, label]) => (
                  <div key={key} className="slot-row">
                    <label className="check grow">
                      <input type="checkbox" checked={slots[key].on !== false} onChange={(e) => setSlot(key, { on: e.target.checked })} />
                      {label}
                    </label>
                    <input className="text-input slot-time" type="time" value={slots[key].time} disabled={slots[key].on === false}
                      aria-label={`${label} reminder time`} onChange={(e) => e.target.value && setSlot(key, { time: e.target.value })} />
                  </div>
                ))}
              </div>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => act(() => testReminder(user.displayName?.split(' ')[0]), 'Sent a sample. Check your notifications.')}>Send a sample now</button>
              <p className="muted small">Times are in your own timezone ({settings.tz}). Reminders can arrive up to about 20 minutes after the time you set. Turn them on separately on each phone you use.</p>
            </>
          )}
        </>
      )}
      {msg && <p className="muted small">{msg}</p>}
    </div>
  )
}
