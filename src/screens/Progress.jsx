import { useEffect, useRef, useState } from 'react'
import { useWeights, useSettings, useProgressPhotos, logWeight, deleteWeight, addProgressPhoto, deleteProgressPhoto, LB_PER_KG } from '../lib/privateData'
import { todayInTz, addDays, prettyDay } from '../lib/dates'
import { compressImage } from '../lib/image'
import { myDriveEnabled, getDriveToken, hasDriveToken, uploadProgressPhoto, progressPhotoUrl, deleteProgressFile } from '../lib/myDrive'
import WeightChart from '../components/WeightChart'

const RANGES = [{ label: '30d', days: 30 }, { label: '90d', days: 90 }, { label: '1y', days: 365 }, { label: 'All', days: 0 }]

export default function Progress({ user, group }) {
  const uid = user.uid
  const today = todayInTz(group.timezone)
  const weights = useWeights(uid)
  const settings = useSettings(uid)
  const unit = settings?.weightUnit || 'kg'
  const toUnit = (kg) => Math.round((unit === 'lb' ? kg * LB_PER_KG : kg) * 10) / 10
  const [date, setDate] = useState(today)
  const [value, setValue] = useState('')
  const [range, setRange] = useState(90)
  const [busy, setBusy] = useState(false)

  const sorted = [...(weights || [])].sort((a, b) => a.date.localeCompare(b.date))
  const inRange = range ? sorted.filter((w) => w.date >= addDays(today, -range)) : sorted
  const points = inRange.map((w) => ({ date: w.date, value: toUnit(w.kg) }))
  const latest = sorted[sorted.length - 1]
  const change = (days) => {
    if (!latest) return null
    const past = [...sorted].reverse().find((w) => w.date <= addDays(latest.date, -days))
    return past ? Math.round((toUnit(latest.kg) - toUnit(past.kg)) * 10) / 10 : null
  }
  const goal = settings?.goalWeightKg ? toUnit(settings.goalWeightKg) : null

  async function save(e) {
    e.preventDefault()
    const v = Number(value)
    if (!v) return
    setBusy(true)
    try { await logWeight(uid, date, unit === 'lb' ? v / LB_PER_KG : v); setValue('') } finally { setBusy(false) }
  }

  const fmt = (x) => (x == null ? '–' : `${x > 0 ? '+' : ''}${x} ${unit}`)

  return (
    <>
      <form className="card form" onSubmit={save}>
        <p className="muted small">Log weight (manual)</p>
        <div className="row">
          <label className="grow">Weight ({unit})
            <input className="text-input" type="number" inputMode="decimal" step="0.1" min="20" max="400" value={value} onChange={(e) => setValue(e.target.value)} placeholder={latest ? String(toUnit(latest.kg)) : unit === 'kg' ? '70.0' : '155.0'} />
          </label>
          <label className="grow">Date
            <input className="text-input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
          </label>
        </div>
        <button className="btn-primary" disabled={busy || !value}>{busy ? 'Saving…' : 'Save weight'}</button>
        <p className="muted small">Same scale, same time of day (e.g. morning, before breakfast) gives the cleanest trend. Logging a date again replaces it.</p>
      </form>

      <div className="stats-row">
        <div className="card stat"><p className="muted small">Latest</p><p className="stat-num">{latest ? toUnit(latest.kg) : '–'}</p><p className="muted small">{latest ? prettyDay(latest.date).split(', ').slice(1).join(', ') : unit}</p></div>
        <div className="card stat"><p className="muted small">7 days</p><p className="stat-num small-num">{fmt(change(7))}</p></div>
        <div className="card stat"><p className="muted small">30 days</p><p className="stat-num small-num">{fmt(change(30))}</p></div>
      </div>

      <div className="card">
        <div className="chips">
          {RANGES.map((r) => <button key={r.label} className={`chip ${range === r.days ? 'on' : ''}`} onClick={() => setRange(r.days)}>{r.label}</button>)}
        </div>
        <WeightChart points={points} unit={unit} goal={goal} />
      </div>

      {sorted.length > 0 && (
        <details className="card history">
          <summary>All entries ({sorted.length})</summary>
          <ul className="member-list">
            {[...sorted].reverse().map((w) => (
              <li key={w.date}>
                <span className="grow">{prettyDay(w.date)}</span>
                <span>{toUnit(w.kg)} {unit}</span>
                <button className="btn-ghost" onClick={() => deleteWeight(uid, w.date)} aria-label={`Delete ${w.date}`}>✕</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <ProgressPhotos uid={uid} user={user} today={today} />
    </>
  )
}

// Optional body-progress photos, saved to YOUR OWN Google Drive.
function ProgressPhotos({ uid, user, today }) {
  const photos = useProgressPhotos(uid)
  const fileRef = useRef(null)
  const [connected, setConnected] = useState(hasDriveToken())
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [compare, setCompare] = useState([])

  async function connect() {
    setError('')
    try { await getDriveToken({ hint: user.email }); setConnected(true) } catch (e) { setError(e.message) }
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy('Uploading to your Drive…'); setError('')
    try {
      const blob = await compressImage(file, { maxSide: 1600, quality: 0.8, targetBytes: 900 * 1024 })
      const fileId = await uploadProgressPhoto(blob, today)
      await addProgressPhoto(uid, { date: today, fileId })
      setConnected(true)
    } catch (err) { setError(err.message) } finally { setBusy('') }
  }

  async function remove(p) {
    if (!confirm('Delete this progress photo from FitPot and your Drive?')) return
    try { await deleteProgressFile(p.fileId) } catch { /* ignore */ }
    await deleteProgressPhoto(uid, p.id)
    setCompare((c) => c.filter((id) => id !== p.id))
  }

  const list = [...(photos || [])].sort((a, b) => b.date.localeCompare(a.date))
  const toggle = (id) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c.slice(-1), id]))
  const pair = compare.map((id) => list.find((p) => p.id === id)).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <>
      <h3 className="section-title">📸 Progress photos · optional</h3>
      {!myDriveEnabled ? (
        <div className="card"><p className="muted small">Progress photos aren't switched on yet. The organiser needs to add a Google sign-in client (docs/BUILD_GUIDE.md, Phase 5).</p></div>
      ) : (
        <div className="card form">
          <p className="muted small">
            🔒 Saved to <strong>your own</strong> Google Drive in a "FitPot Progress" folder. Nobody in the group can see them.
            FitPot can only access files it created there, nothing else in your Drive.
          </p>
          {!connected ? (
            <button className="btn-ghost" onClick={connect}>Connect my Google Drive</button>
          ) : (
            <>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
              <button className="btn-primary" disabled={!!busy} onClick={() => fileRef.current.click()}>{busy || '＋ Add progress photo'}</button>
            </>
          )}
          {error && <p className="error small">{error}</p>}
        </div>
      )}

      {myDriveEnabled && list.length > 0 && (
        !connected ? (
          <button className="btn-ghost wide" onClick={connect}>Show my {list.length} progress photo{list.length > 1 ? 's' : ''}</button>
        ) : (
          <>
            {pair.length === 2 && (
              <div className="compare">
                {pair.map((p) => <ProgressImage key={p.id} photo={p} caption={prettyDay(p.date)} />)}
              </div>
            )}
            <p className="muted small">Tap two photos to compare them side by side.</p>
            <div className="photo-grid">
              {list.map((p) => (
                <figure key={p.id} className={`photo-card ${compare.includes(p.id) ? 'selected' : ''}`}>
                  <button className="plain" onClick={() => toggle(p.id)}><ProgressImage photo={p} /></button>
                  <figcaption>
                    <span className="grow">{prettyDay(p.date).split(', ').slice(1).join(', ')}</span>
                    <button className="btn-ghost" onClick={() => remove(p)} aria-label="Delete photo">✕</button>
                  </figcaption>
                </figure>
              ))}
            </div>
          </>
        )
      )}
    </>
  )
}

function ProgressImage({ photo, caption }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    progressPhotoUrl(photo.fileId).then((u) => alive && setUrl(u)).catch(() => alive && setFailed(true))
    return () => { alive = false }
  }, [photo.fileId])
  return (
    <div className="progress-img">
      {url ? <img src={url} alt={`Progress photo ${photo.date}`} /> : <div className="photo-placeholder">{failed ? 'Not found in Drive' : 'Loading…'}</div>}
      {caption && <span className="muted small">{caption}</span>}
    </div>
  )
}
