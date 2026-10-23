import { useEffect } from 'react'

// The food plate: a dinner plate with a wedge for each meal and My foods,
// and today's calories in the middle. Picking a wedge opens that part
// of the Food diary straight away.
// Five wedges, 72 degrees each, starting at the top and going clockwise.
const WEDGES = [
  { key: 'Breakfast', label: 'Breakfast', at: [50, 15] },
  { key: 'Lunch', label: 'Lunch', at: [83, 39] },
  { key: 'Dinner', label: 'Dinner', at: [71, 78] },
  { key: 'Snacks', label: 'Snacks', at: [29, 78] },
  { key: 'myfoods', label: 'My foods', sub: '& recipes', at: [17, 39] },
]

export default function FoodPlate({ kcalByMeal = {}, total = 0, target = 0, onPick, onClose }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="chooser" role="dialog" aria-modal="true" aria-label="Food" onClick={onClose}>
      <div className="safe-card plate-safe" onClick={(e) => e.stopPropagation()}>
        <span className="safe-dial" aria-hidden="true" />
        <span><strong>Food safe: Plate scan</strong><br /><span className="orange small">Being built (Phase 6)</span></span>
      </div>
      <div className="food-plate" onClick={(e) => e.stopPropagation()}>
        <span className="plate-rim" aria-hidden="true" />
        <span className="plate-face" aria-hidden="true" />
        {WEDGES.map((w, i) => (
          <button key={w.key} className="wedge" style={{ left: `${w.at[0]}%`, top: `${w.at[1]}%`, animationDelay: `${i * 30}ms` }} onClick={() => onPick(w.key)}>
            <strong>{w.label}</strong>
            <span>{w.sub || (kcalByMeal[w.key] ? `${Math.round(kcalByMeal[w.key])} kcal` : '+ Add')}</span>
          </button>
        ))}
        <span className="plate-center">
          <b>{Math.round(total).toLocaleString()}</b>
          <span>{target ? `of ${Number(target).toLocaleString()} kcal` : 'kcal today'}</span>
        </span>
      </div>
    </div>
  )
}
