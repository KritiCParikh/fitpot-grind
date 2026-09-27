import { useState } from 'react'
import { NUTRIENTS, sumNutrients, scale } from '../lib/foods'
import { saveMyFood, deleteMyFood } from '../lib/privateData'
import FoodPicker from './FoodPicker'
import PortionPicker from './PortionPicker'

const blankNutrients = () => Object.fromEntries(NUTRIENTS.map((n) => [n.key, '']))

// Create or edit one of your own foods (values per serving, e.g. from a label).
export function MyFoodForm({ uid, initial, barcode, onSaved, onBack }) {
  const [name, setName] = useState(initial?.name || '')
  const [servingLabel, setServingLabel] = useState(initial?.servingLabel || 'serving')
  const [servingGrams, setServingGrams] = useState(initial?.servingGrams ?? '')
  const [values, setValues] = useState(initial?.perServing ? Object.fromEntries(NUTRIENTS.map((n) => [n.key, initial.perServing[n.key] ?? ''])) : blankNutrients())
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await saveMyFood(uid, {
        id: initial?.id, kind: 'food', name: name.trim(), barcode: initial?.barcode || barcode || null,
        servingLabel: servingLabel.trim() || 'serving', servingGrams: Number(servingGrams) || null,
        perServing: Object.fromEntries(NUTRIENTS.map((n) => [n.key, Number(values[n.key]) || 0])),
      })
      onSaved()
    } finally { setBusy(false) }
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn-ghost" onClick={onBack} aria-label="Back">‹</button>
        <strong>{initial?.id ? 'Edit food' : 'Create food'}</strong>
        <span style={{ width: 40 }} />
      </div>
      {barcode && !initial && <p className="muted small">Barcode {barcode} wasn't found. Enter the label once and it'll scan instantly next time.</p>}
      <div className="card form">
        <label>Name<input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mom's rajma, Yoga Bar protein bar" /></label>
        <div className="row">
          <label className="grow">Serving<input className="text-input" value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} placeholder="bowl, bar, scoop" /></label>
          <label className="grow">Grams (optional)<input className="text-input" type="number" inputMode="decimal" value={servingGrams} onChange={(e) => setServingGrams(e.target.value)} /></label>
        </div>
        <p className="muted small">Nutrition per one {servingLabel || 'serving'}</p>
        <div className="nutri-inputs">
          {NUTRIENTS.map((n) => (
            <label key={n.key}>{n.label} ({n.unit})
              <input className="text-input" type="number" inputMode="decimal" step="any" value={values[n.key]} onChange={(e) => setValues((v) => ({ ...v, [n.key]: e.target.value }))} />
            </label>
          ))}
        </div>
      </div>
      <button className="btn-primary wide" disabled={busy || !name.trim()} onClick={save}>{busy ? 'Saving…' : 'Save food'}</button>
      {initial?.id && <button className="btn-ghost wide" onClick={async () => { await deleteMyFood(uid, initial.id); onSaved() }}>Delete</button>}
    </div>
  )
}

// Build a recipe from ingredients; it's saved as one of your foods, per serving.
export function RecipeBuilder({ uid, initial, onSaved, onBack }) {
  const [name, setName] = useState(initial?.name || '')
  const [servings, setServings] = useState(initial?.servings || 1)
  const [items, setItems] = useState(initial?.ingredients || [])
  const [step, setStep] = useState('main') // main | pick | portion
  const [picked, setPicked] = useState(null)
  const [busy, setBusy] = useState(false)

  const total = sumNutrients(items.map((i) => i.nutrients))
  const n = Math.max(1, Number(servings) || 1)
  const perServing = scale(total, 1 / n)
  const allGrams = items.length > 0 && items.every((i) => i.grams != null)
  const totalGrams = allGrams ? items.reduce((s, i) => s + i.grams, 0) : null

  async function save() {
    setBusy(true)
    try {
      await saveMyFood(uid, {
        id: initial?.id, kind: 'recipe', name: name.trim(), servings: n,
        servingLabel: 'serving', servingGrams: totalGrams ? Math.round(totalGrams / n) : null,
        perServing, ingredients: items,
      })
      onSaved()
    } finally { setBusy(false) }
  }

  if (step === 'pick') return <FoodPicker uid={uid} title="Add ingredient" onPick={(f) => { setPicked(f); setStep('portion') }} onClose={() => setStep('main')} />
  if (step === 'portion') {
    return (
      <PortionPicker uid={uid} food={picked} showMeal={false} actionLabel="Add ingredient" onBack={() => setStep('pick')}
        onDone={({ food, qty, unit, nutrients, grams }) => {
          setItems((xs) => [...xs, { name: food.name, qty, unit: unit.label, grams, nutrients }])
          setStep('main')
        }} />
    )
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn-ghost" onClick={onBack} aria-label="Back">‹</button>
        <strong>{initial?.id ? 'Edit recipe' : 'New recipe'}</strong>
        <span style={{ width: 40 }} />
      </div>
      <div className="card form">
        <label>Recipe name<input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken curry (home)" /></label>
        <label>Makes how many servings?<input className="text-input" type="number" min="1" inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value)} /></label>
      </div>

      <h3 className="section-title">Ingredients · {items.length}</h3>
      <ul className="member-list">
        {items.map((it, i) => (
          <li key={i}>
            <span className="grow">{it.name}<span className="muted small"> · {it.qty} {it.unit}</span></span>
            <span className="muted small">{Math.round(it.nutrients.kcal)} kcal</span>
            <button className="btn-ghost" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
          </li>
        ))}
      </ul>
      <button className="btn-ghost wide" onClick={() => setStep('pick')}>＋ Add ingredient</button>

      <div className="card nutri-grid">
        <p className="muted small full">Per serving (of {n}){totalGrams ? ` · ≈ ${Math.round(totalGrams / n)} g` : ''}</p>
        {NUTRIENTS.map((x) => (
          <div key={x.key}><p className="muted small">{x.label}</p><p className="stat-num small-num">{perServing[x.key]}<span className="muted small"> {x.unit}</span></p></div>
        ))}
      </div>
      <button className="btn-primary wide" disabled={busy || !name.trim() || !items.length} onClick={save}>{busy ? 'Saving…' : 'Save recipe'}</button>
      {initial?.id && <button className="btn-ghost wide" onClick={async () => { await deleteMyFood(uid, initial.id); onSaved() }}>Delete recipe</button>}
    </div>
  )
}
