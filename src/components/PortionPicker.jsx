import { useState } from 'react'
import { NUTRIENTS, scale, SOURCE_LABEL, MEALS } from '../lib/foods'
import { saveMyFood } from '../lib/privateData'

// Choose how much of a food: quantity × unit, with a live nutrition preview.
export default function PortionPicker({ uid, food, meal, showMeal = true, actionLabel, onDone, onBack }) {
  const defaultUnit = food.lastUnit ? Math.max(0, food.units.findIndex((u) => u.label === food.lastUnit)) : 0
  const [unitIdx, setUnitIdx] = useState(defaultUnit)
  const [qty, setQty] = useState(food.lastQty ?? (food.units[defaultUnit]?.label === 'g' ? 100 : 1))
  const [mealSel, setMealSel] = useState(meal || 'Snacks')
  const [saved, setSaved] = useState(false)

  const unit = food.units[unitIdx] || food.units[0]
  const amount = Number(qty) || 0
  const nutrients = scale(food.base, amount * unit.factor)
  const grams = unit.grams ? Math.round(amount * unit.grams) : null

  async function saveToMine() {
    await saveMyFood(uid, {
      kind: 'food', name: food.name, barcode: food.barcode || null,
      servingLabel: unit.label, servingGrams: unit.grams || null,
      perServing: scale(food.base, unit.factor),
    })
    setSaved(true)
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn-ghost" onClick={onBack} aria-label="Back">‹</button>
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

      <button className="btn-primary wide" disabled={amount <= 0} onClick={() => onDone({ food, qty: amount, unit, nutrients, meal: mealSel, grams })}>
        {actionLabel || `Add to ${mealSel}`}
      </button>
      {food.source !== 'mine' && food.source !== 'recipe' && (
        <button className="btn-ghost wide" onClick={saveToMine} disabled={saved}>{saved ? '⭐ Saved to My foods' : `⭐ Save "${unit.label}" to My foods`}</button>
      )}
    </div>
  )
}
