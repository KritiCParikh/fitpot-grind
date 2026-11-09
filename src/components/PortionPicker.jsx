import { useState } from 'react'
import { NUTRIENTS, scale, SOURCE_LABEL, MEALS } from '../lib/foods'
import { saveMyFood } from '../lib/privateData'
import { useAutoDraft } from '../lib/drafts'

// Choose how much of a food: quantity × unit, with a live nutrition preview.
// `draft` ({ id, day, state }): when logging a meal, the pick is kept in
// Drafts until it's added, so closing the app doesn't lose it (phase 5.12).
export default function PortionPicker({ uid, food, meal, showMeal = true, actionLabel, onDone, onBack, draft }) {
  const defaultUnit = food.lastUnit ? Math.max(0, food.units.findIndex((u) => u.label === food.lastUnit)) : 0
  const r = draft?.state
  const [unitIdx, setUnitIdx] = useState(r?.unitIdx ?? defaultUnit)
  const [qty, setQty] = useState(r?.qty ?? food.lastQty ?? (food.units[defaultUnit]?.label === 'g' ? 100 : 1))
  const [mealSel, setMealSel] = useState(r?.mealSel || meal || 'Snacks')
  const kept = useAutoDraft(draft ? uid : null, draft?.id, { qty, unitIdx, mealSel }, (state) => ({
    kind: 'meal',
    title: food.name,
    sub: `${state.qty} ${food.units[state.unitIdx]?.label || ''} · ${state.mealSel}`,
    to: `/locker?me=food&draft=${draft.id}`,
    data: { food, day: draft.day, state },
  }), { always: true })
  const [saved, setSaved] = useState(false)

  const unit = food.units[unitIdx] || food.units[0]
  const amount = Number(qty) || 0
  const nutrients = scale(food.base, amount * unit.factor)
  const grams = unit.grams ? Math.round(amount * unit.grams) : null

  async function saveToMine() {
    await saveMyFood(uid, {
      kind: 'food', name: food.name,
      servingLabel: unit.label, servingGrams: unit.grams || null,
      perServing: scale(food.base, unit.factor),
    })
    setSaved(true)
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn-ghost" onClick={() => { kept.finish(); onBack() }} aria-label="Back">‹</button>
        <strong className="grow center-text">{food.name}</strong>
        <span style={{ width: 40 }} />
      </div>
      <p className="muted small center-text">{[food.brand, SOURCE_LABEL[food.source]].filter(Boolean).join(' · ')}</p>

      <div className="card form">
        <div className="row">
          <label className="grow">Amount
            <input className="text-input" type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label className="grow">Unit
            <select value={unitIdx} onChange={(e) => {
              const i = +e.target.value
              setUnitIdx(i)
              setQty(food.units[i].label === 'g' ? 100 : 1)
            }}>
              {food.units.map((u, i) => <option key={i} value={i}>{u.label}</option>)}
            </select>
          </label>
        </div>
        {showMeal && (
          <div className="chips">
            {MEALS.map((m) => <button key={m} className={`chip ${mealSel === m ? 'on' : ''}`} onClick={() => setMealSel(m)}>{m}</button>)}
          </div>
        )}
      </div>

      <div className="card nutri-grid">
        {NUTRIENTS.map((n) => (
          <div key={n.key}>
            <p className="muted small">{n.label}</p>
            <p className="stat-num small-num">{nutrients[n.key]}<span className="muted small"> {n.unit}</span></p>
          </div>
        ))}
        {grams != null && <p className="muted small full">≈ {grams} g</p>}
      </div>

      <button className="btn-primary wide" disabled={amount <= 0} onClick={async () => { await onDone({ food, qty: amount, unit, nutrients, meal: mealSel, grams }); kept.finish() }}>
        {actionLabel || `Add to ${mealSel}`}
      </button>
      {food.source !== 'mine' && food.source !== 'recipe' && (
        <button className="btn-ghost wide" onClick={saveToMine} disabled={saved}>{saved ? 'Saved to My foods' : `Save "${unit.label}" to My foods`}</button>
      )}
    </div>
  )
}
