import { useEffect, useMemo, useState } from 'react'
import { searchIndia, searchUSA, searchPackaged, searchMine, lookupBarcode, fromMyFood, SOURCE_LABEL } from '../lib/foods'
import { useMyFoods, useRecentMeals } from '../lib/privateData'
import BarcodeScanner from './BarcodeScanner'

const SOURCES = [
  { key: 'india', label: '🇮🇳 India' },
  { key: 'usa', label: '🇺🇸 USA' },
  { key: 'packaged', label: '📦 Packaged' },
]

// Full-screen food finder: Recent · My foods · search across India / USA /
// packaged foods · barcode. Calls onPick(food) with a normalised food.
export default function FoodPicker({ uid, title = 'Add food', onPick, onClose, onCreate, onBarcodeMissing, extraActions }) {
  const myFoodsRaw = useMyFoods(uid)
  const recentMeals = useRecentMeals(uid)
  const [q, setQ] = useState('')
  const [on, setOn] = useState({ india: true, usa: true, packaged: true })
  const [results, setResults] = useState({})
  const [errors, setErrors] = useState({})
  const [scan, setScan] = useState(false)
  const [scanMsg, setScanMsg] = useState('')

  const myFoods = useMemo(() => (myFoodsRaw || []).map(fromMyFood), [myFoodsRaw])
  const recents = useMemo(() => {
    const seen = new Set(), out = []
    for (const m of recentMeals || []) {
      if (!m.food || seen.has(m.food.key)) continue
      seen.add(m.food.key); out.push({ ...m.food, lastQty: m.qty, lastUnit: m.unit })
      if (out.length >= 15) break
    }
    return out
  }, [recentMeals])

  // Debounced search across the enabled sources, each independently.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      const run = (key, fn) => {
        if (!on[key]) return
        setResults((r) => ({ ...r, [key]: undefined }))
        fn(term, ctrl.signal)
          .then((list) => { setResults((r) => ({ ...r, [key]: list })); setErrors((e) => ({ ...e, [key]: '' })) })
          .catch((e) => { if (e.name !== 'AbortError') { setResults((r) => ({ ...r, [key]: [] })); setErrors((x) => ({ ...x, [key]: e.message })) } })
      }
      run('india', searchIndia)
      run('usa', searchUSA)
      run('packaged', searchPackaged)
    }, 350)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q, on])

  async function onCode(code) {
    setScan(false); setScanMsg('Looking up…')
    const mine = myFoods.find((f) => f.barcode === code)
    if (mine) { setScanMsg(''); return onPick(mine) }
    try {
      const food = await lookupBarcode(code)
      if (food) { setScanMsg(''); return onPick(food) }
    } catch { /* treat as not found */ }
    setScanMsg('')
    onBarcodeMissing?.(code)
  }

  const term = q.trim()
  const mineHits = term.length >= 2 ? searchMine(myFoods, term) : []

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn-ghost" onClick={onClose} aria-label="Back">‹</button>
        <strong>{title}</strong>
        <span style={{ width: 40 }} />
      </div>

      <input className="text-input search" autoFocus placeholder="Search foods: dal, paneer, oats, whey…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="chips">
        {SOURCES.map((s) => (
          <button key={s.key} className={`chip ${on[s.key] ? 'on' : ''}`} onClick={() => setOn((o) => ({ ...o, [s.key]: !o[s.key] }))}>{s.label}</button>
        ))}
      </div>

      <div className="action-row">
        <button className="btn-ghost" onClick={() => setScan(true)}>▦ Scan barcode</button>
        {onCreate && <button className="btn-ghost" onClick={() => onCreate()}>＋ Create food</button>}
        {extraActions}
      </div>
      {scanMsg && <p className="muted small">{scanMsg}</p>}

      {term.length < 2 ? (
        <>
          {recents.length > 0 && <FoodList title="Recent" foods={recents} onPick={onPick} />}
          {myFoods.length > 0 && <FoodList title="My foods & recipes" foods={myFoods} onPick={onPick} />}
          {!recents.length && !myFoods.length && <p className="muted small">Type at least 2 letters to search. Foods you log or save show up here for one-tap logging.</p>}
        </>
      ) : (
        <>
          {mineHits.length > 0 && <FoodList title="My foods & recipes" foods={mineHits} onPick={onPick} />}
          {SOURCES.filter((s) => on[s.key]).map((s) => (
            <FoodList key={s.key} title={s.label} foods={results[s.key]} error={errors[s.key]} onPick={onPick} />
          ))}
        </>
      )}

      {scan && <BarcodeScanner onCode={onCode} onClose={() => setScan(false)} />}
    </div>
  )
}

function FoodList({ title, foods, error, onPick }) {
  return (
    <>
      <h3 className="section-title">{title}</h3>
      {foods === undefined ? <p className="muted small">Searching…</p>
        : error ? <p className="error small">{error}</p>
        : foods.length === 0 ? <p className="muted small">No matches.</p>
        : (
          <ul className="food-list">
            {foods.map((f) => (
              <li key={f.key}>
                <button onClick={() => onPick(f)}>
                  <span className="grow-col">
                    <span className="food-name">{f.name}</span>
                    <span className="muted small">{[f.brand, SOURCE_LABEL[f.source]].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="muted small nowrap">{Math.round(f.base.kcal)} kcal / {f.units.find((u) => u.factor === 1)?.label || '100 g'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
    </>
  )
}
