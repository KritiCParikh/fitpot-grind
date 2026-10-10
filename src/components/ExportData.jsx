import { useState } from 'react'
import { readAllPrivate } from '../lib/privateData'
import { muscleLabel } from '../lib/training'

// "Export my data": download your private data as CSV (opens in Excel or
// Google Sheets) or everything as one JSON file. Nothing leaves your phone
// except to your own downloads.
function csv(rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const byDate = (a, b) => String(a.date).localeCompare(String(b.date))

const EXPORTS = {
  workouts: (d) => [['date', 'workout', 'exercise', 'muscle', 'set', 'weight_kg', 'reps', 'notes'],
    ...d.workouts.sort(byDate).flatMap((w) => (w.exercises || []).flatMap((x) => x.sets.map((s, i) => [w.date, w.title || '', x.name, muscleLabel(x.muscle), i + 1, s.kg || 0, s.reps, i === 0 ? w.notes || '' : ''])))],
  food: (d) => [['date', 'meal', 'food', 'amount', 'unit', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'],
    ...d.meals.sort(byDate).map((m) => [m.date, m.meal, m.name, m.qty, m.unit, ...['kcal', 'protein', 'carbs', 'fat', 'fibre'].map((k) => Math.round((m.nutrients?.[k] || 0) * 10) / 10)])],
  weight: (d) => [['date', 'weight_kg'], ...d.weights.sort(byDate).map((w) => [w.date, w.kg])],
  measurements: (d) => [['date', 'waist_cm', 'chest_cm', 'hips_cm', 'arm_cm', 'thigh_cm', 'neck_cm', 'body_fat_pct'],
    ...d.measurements.sort(byDate).map((m) => [m.date, ...['waist', 'chest', 'hips', 'arm', 'thigh', 'neck'].map((k) => m.cm?.[k] ?? ''), m.bodyFat ?? ''])],
}

export default function ExportData({ uid }) {
  const [busy, setBusy] = useState('')
  const stamp = new Date().toISOString().slice(0, 10)

  async function run(kind) {
    setBusy(kind)
    try {
      const data = await readAllPrivate(uid)
      if (kind === 'all') download(`fitpot-my-data-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json')
      else download(`fitpot-${kind}-${stamp}.csv`, csv(EXPORTS[kind](data)), 'text/csv')
    } catch (e) { alert(e.message || String(e)) } finally { setBusy('') }
  }

  return (
    <div className="card form">
      <p className="muted small">Export my data: your private records as files you keep. CSV opens in Excel or Google Sheets.</p>
      <div className="action-row">
        {['workouts', 'food', 'weight', 'measurements'].map((k) => (
          <button key={k} type="button" className="btn-ghost" disabled={Boolean(busy)} onClick={() => run(k)}>{busy === k ? '…' : `${k[0].toUpperCase()}${k.slice(1)} (CSV)`}</button>
        ))}
        <button type="button" className="btn-ghost" disabled={Boolean(busy)} onClick={() => run('all')}>{busy === 'all' ? '…' : 'Everything (JSON)'}</button>
      </div>
      <p className="muted small">Group data (check-ins, the pot) isn't included; it belongs to the group. Progress photos stay in your own Google Drive.</p>
    </div>
  )
}
