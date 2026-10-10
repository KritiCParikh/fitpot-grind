import { useEffect } from 'react'
import Icon from './Icon'

// The plate dial: Training's five sections fanned out in an arc above the
// Training plate, with the safe for what's being built in the middle.
export const TRAINING_SECTIONS = [
  { key: 'log', label: 'Log', icon: 'log' },
  { key: 'muscles', label: 'Muscles', icon: 'muscles' },
  { key: 'records', label: 'Records', icon: 'board' },
  { key: 'routines', label: 'Routines', icon: 'plan' },
  { key: 'setup', label: 'Setup', icon: 'account' },
]
// Positions on the arc (percent of the dial box), left to right.
const SPOTS = [[17, 66], [22, 32], [50, 14], [78, 32], [83, 66]]

export default function TrainingDial({ section, onPick, onClose }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="chooser" role="dialog" aria-modal="true" aria-label="Training sections" onClick={onClose}>
      <div className="dial" onClick={(e) => e.stopPropagation()}>
        {TRAINING_SECTIONS.map((s, i) => (
          <button key={s.key} className={`dial-plate ${section === s.key ? 'on' : ''}`}
            style={{ left: `${SPOTS[i][0]}%`, top: `${SPOTS[i][1]}%`, animationDelay: `${i * 30}ms` }}
            onClick={() => onPick(s.key)} aria-current={section === s.key ? 'true' : undefined}>
            <Icon name={s.icon} size={22} />
            <span>{s.label}</span>
          </button>
        ))}
        <div className="dial-plate locked" style={{ left: '50%', top: '58%' }} aria-label="My plan, being built">
          <Icon name="lock" size={20} />
          <span>My plan</span>
          <em>Being built</em>
        </div>
      </div>
    </div>
  )
}
