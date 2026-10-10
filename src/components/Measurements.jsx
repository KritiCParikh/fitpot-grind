import { useState } from 'react'
import { useMeasurements, logMeasurements, deleteMeasurements, saveSettings, CM_PER_IN } from '../lib/privateData'
import { prettyDay } from '../lib/dates'
import { myToday } from '../lib/clock'

export const SITES = [
  { key: 'waist', label: 'Waist' },
  { key: 'chest', label: 'Chest' },
  { key: 'hips', label: 'Hips' },
  { key: 'arm', label: 'Arm (flexed)' },
  { key: 'thigh', label: 'Thigh' },
  { key: 'neck', label: 'Neck' },
]
const short = (d) => prettyDay(d).split(', ').slice(1).join(', ')

// Body measurements (cm or in, stored in cm), one entry per date.
export default function Measurements({ uid, settings }) {
  const today = myToday()
  const list = useMeasurements(uid)
  const unit = settings.measureUnit || 'cm'
  const toU = (cm) => (cm ? Math.round((unit === 'in' ? cm / CM_PER_IN : cm) * 10) / 10 : null)
  const [date, setDate] = useState(today)
  const [vals, setVals] = useState({})
  const [bf, setBf] = useState('')
  const [busy, setBusy] = useState(false)

  const sorted = [...(list || [])].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0], latest = sorted[sorted.length - 1]

  async function save(e) {
    e.preventDefault()
    const cm = Object.fromEntries(SITES.filter((s) => Number(vals[s.key]) > 0).map((s) => [s.key, Math.round((unit === 'in' ? Number(vals[s.key]) * CM_PER_IN : Number(vals[s.key])) * 10) / 10]))
    if (!Object.keys(cm).length && !Number(bf)) return
    setBusy(true)
    try { await logMeasurements(uid, date, { cm, bodyFat: Number(bf) || null }); setVals({}); setBf('') } finally { setBusy(false) }
  }

  return (
    <>
      <form className="card form" onSubmit={save}>
        <div className="row">
          <p className="muted small grow">Body measurements (optional). Measure at the same spot, same time of day.</p>
          <select value={unit} aria-label="Measurement unit" onChange={(e) => saveSettings(uid, { measureUnit: e.target.value })}>
            <option value="cm">cm</option>
            <option value="in">in</option>
          </select>
        </div>
        <div className="nutri-inputs">
          {SITES.map((s) => (
            <label key={s.key}>{s.label} ({unit})
              <input className="text-input" type="number" inputMode="decimal" step="0.1" min="0" value={vals[s.key] || ''}
                placeholder={latest?.cm?.[s.key] ? String(toU(latest.cm[s.key])) : ''} onChange={(e) => setVals((v) => ({ ...v, [s.key]: e.target.value }))} />
            </label>
          ))}
          <label>Body fat (%)
            <input className="text-input" type="number" inputMode="decimal" step="0.1" min="0" max="70" value={bf} placeholder={latest?.bodyFat ? String(latest.bodyFat) : ''} onChange={(e) => setBf(e.target.value)} />
          </label>
          <label>Date
            <input className="text-input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
          </label>
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save measurements'}</button>
      </form>

      {latest && (
        <div className="card">
          <p className="muted small">Latest ({short(latest.date)}){first !== latest ? ` vs first (${short(first.date)})` : ''}</p>
          <ul className="member-list">
            {SITES.filter((s) => latest.cm?.[s.key]).map((s) => {
              const a = toU(latest.cm[s.key]), b = first.cm?.[s.key] ? toU(first.cm[s.key]) : null
              const d = b != null && first !== latest ? Math.round((a - b) * 10) / 10 : null
              return (
                <li key={s.key}>
                  <span className="grow">{s.label}</span>
                  <span>{a} {unit}</span>
                  {d != null && <span className="muted small">{d > 0 ? '+' : ''}{d}</span>}
                </li>
              )
            })}
            {latest.bodyFat ? <li><span className="grow">Body fat</span><span>{latest.bodyFat}%</span></li> : null}
          </ul>
          <details className="history">
            <summary>All entries ({sorted.length})</summary>
            <ul className="member-list">
              {[...sorted].reverse().map((m) => (
                <li key={m.date}>
                  <span className="grow">{short(m.date)}<br /><span className="muted small">{SITES.filter((s) => m.cm?.[s.key]).map((s) => `${s.label} ${toU(m.cm[s.key])}`).join(' · ')}{m.bodyFat ? ` · ${m.bodyFat}% fat` : ''}</span></span>
                  <button className="btn-ghost" aria-label={`Delete ${m.date}`} onClick={() => deleteMeasurements(uid, m.date)}>✕</button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </>
  )
}
