import { useState } from 'react'
import { NUTRIENTS, sumNutrients, MEALS } from '../lib/foods'
import { useMealsOn, useSettings, useMyFoods, logMeal, deleteMeal } from '../lib/privateData'
import { todayInTz, addDays, prettyDay } from '../lib/dates'
import FoodPicker from '../components/FoodPicker'
import PortionPicker from '../components/PortionPicker'
import { MyFoodForm, RecipeBuilder } from '../components/MyFoodForms'

// Private, optional food diary. Nothing here affects check-ins or the pot.
export default function FoodLog({ user, group }) {
  const uid = user.uid
  const today = todayInTz(group.timezone)
  const [day, setDay] = useState(today)
  const meals = useMealsOn(uid, day)
  const settings = useSettings(uid)
  const myFoods = useMyFoods(uid)
  const [view, setView] = useState({ name: 'log' })

  const targets = settings?.targets || {}
  const back = () => setView({ name: 'log' })

  // ---- sub-screens ----
  if (view.name === 'pick') {
    return (
      <FoodPicker uid={uid} title={`Add to ${view.meal}`}
        onPick={(food) => setView({ name: 'portion', meal: view.meal, food })}
        onClose={back}
        onCreate={() => setView({ name: 'create', meal: view.meal })}
        onBarcodeMissing={(code) => setView({ name: 'create', meal: view.meal, barcode: code })}
        extraActions={<button className="btn-ghost" disabled title="Arrives with your own vision model (phase 6)">📷 Scan plate · soon</button>}
      />
    )
  }
  if (view.name === 'portion') {
    return (
      <PortionPicker uid={uid} food={view.food} meal={view.meal}
        onBack={() => setView({ name: 'pick', meal: view.meal })}
        onDone={async ({ food, qty, unit, nutrients, meal }) => {
          await logMeal(uid, { date: day, meal, food, qty, unit, nutrients })
          back()
        }} />
    )
  }
  if (view.name === 'create') return <MyFoodForm uid={uid} barcode={view.barcode} onSaved={() => setView({ name: 'pick', meal: view.meal || 'Snacks' })} onBack={() => setView({ name: 'pick', meal: view.meal || 'Snacks' })} />
  if (view.name === 'editFood') return <MyFoodForm uid={uid} initial={view.food} onSaved={() => setView({ name: 'myfoods' })} onBack={() => setView({ name: 'myfoods' })} />
  if (view.name === 'recipe') return <RecipeBuilder uid={uid} initial={view.food} onSaved={() => setView({ name: 'myfoods' })} onBack={() => setView({ name: 'myfoods' })} />
  if (view.name === 'myfoods') {
    return (
      <div className="sheet">
        <div className="sheet-head">
          <button className="btn-ghost" onClick={back} aria-label="Back">‹</button>
          <strong>My foods & recipes</strong>
          <span style={{ width: 40 }} />
        </div>
        <div className="action-row">
          <button className="btn-ghost" onClick={() => setView({ name: 'editFood', food: null })}>＋ Food</button>
          <button className="btn-ghost" onClick={() => setView({ name: 'recipe', food: null })}>🍲 Recipe</button>
        </div>
        {!myFoods?.length ? <p className="muted small">Nothing saved yet. Save foods from search (⭐), create your own, or build a recipe.</p> : (
          <ul className="food-list">
            {[...myFoods].sort((a, b) => a.name.localeCompare(b.name)).map((f) => (
              <li key={f.id}>
                <button onClick={() => setView({ name: f.kind === 'recipe' ? 'recipe' : 'editFood', food: f })}>
                  <span className="grow-col">
                    <span className="food-name">{f.kind === 'recipe' ? '🍲 ' : '⭐ '}{f.name}</span>
                    <span className="muted small">{Math.round(f.perServing?.kcal || 0)} kcal / {f.servingLabel || 'serving'}{f.barcode ? ' · ▦' : ''}</span>
                  </span>
                  <span className="muted small">Edit</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // ---- main diary ----
  const totals = sumNutrients((meals || []).map((m) => m.nutrients))
  return (
    <>
      <div className="cal-head">
        <button className="btn-ghost" onClick={() => setDay((d) => addDays(d, -1))} aria-label="Previous day">‹</button>
        <strong>{day === today ? 'Today' : prettyDay(day)}</strong>
        <button className="btn-ghost" onClick={() => setDay((d) => addDays(d, 1))} disabled={day >= today} aria-label="Next day">›</button>
      </div>

      <div className="card totals">
        {NUTRIENTS.map((n) => {
          const t = Number(targets[n.key]) || 0
          const v = totals[n.key]
          const pct = t ? Math.min(100, (v / t) * 100) : 0
          return (
            <div key={n.key} className="total-row">
              <span className="total-label">{n.label}</span>
              <span className="total-bar">{t > 0 && <i style={{ width: `${pct}%` }} className={v > t * 1.05 && n.key === 'kcal' ? 'over' : ''} />}</span>
              <span className="total-val">{Math.round(v)}{t ? <span className="muted"> / {t}</span> : ''} <span className="muted small">{n.unit}</span></span>
            </div>
          )
        })}
        {!Object.values(targets).some(Number) && <p className="muted small">Set your targets in the Targets tab to see progress bars.</p>}
      </div>

      {meals === undefined ? <p className="muted">Loading…</p> : MEALS.map((meal) => {
        const list = meals.filter((m) => m.meal === meal)
        const kcal = Math.round(list.reduce((s, m) => s + (m.nutrients?.kcal || 0), 0))
        return (
          <div key={meal}>
            <h3 className="section-title meal-head">
              <span>{meal}{kcal ? ` · ${kcal} kcal` : ''}</span>
              <button className="link-btn" onClick={() => setView({ name: 'pick', meal })}>＋ Add</button>
            </h3>
            {list.length > 0 && (
              <ul className="member-list">
                {list.map((m) => (
                  <li key={m.id}>
                    <span className="grow">{m.name}<span className="muted small"> · {m.qty} {m.unit}</span></span>
                    <span className="muted small nowrap">{Math.round(m.nutrients?.kcal || 0)} kcal · {Math.round(m.nutrients?.protein || 0)}g P</span>
                    <button className="btn-ghost" onClick={() => deleteMeal(uid, m.id)} aria-label={`Remove ${m.name}`}>✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      <button className="btn-ghost wide" style={{ marginTop: 16 }} onClick={() => setView({ name: 'myfoods' })}>⭐ My foods & recipes</button>
      <p className="muted small">Food logging is optional and private. Only you can see it, and it never affects the pot. Indian dishes: Indian Nutrient Databank (INDB). US foods: USDA FoodData Central. Packaged: Open Food Facts.</p>
    </>
  )
}
