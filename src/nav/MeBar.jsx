import Icon from './Icon'

// Me's bottom bar: a barbell with four plates. Tap a plate to go there.
// Tap the Food plate again to open the food plate (meals and My foods).
// Training switches sections with its own tabs (phase 5.7.1).
export const ME_TABS = [
  { key: 'food', label: 'Food', icon: 'food' },
  { key: 'training', label: 'Training', icon: 'training' },
  { key: 'progress', label: 'Progress', icon: 'progress' },
  { key: 'targets', label: 'Targets', icon: 'targets' },
]

export default function MeBar({ tab, sectionLabel, onTab }) {
  return (
    <nav className="barbell me-bar" aria-label="Me sections">
      <span className="barbell-bar" aria-hidden="true"><i className="collar l" /><i className="collar r" /></span>
      {ME_TABS.map((t) => (
        <button key={t.key} className={`plate-stop ${tab === t.key ? 'on' : ''}`} onClick={() => onTab(t.key)}
          aria-current={tab === t.key ? 'page' : undefined}
          aria-label={tab === t.key && t.key === 'food' ? `${t.label}: choose a section` : t.label}>
          <span className="plate"><Icon name={t.icon} size={22} /></span>
          <span className="plate-label">{t.label}</span>
          {t.key === 'training' && tab === 'training' && sectionLabel && <span className="plate-sub">{sectionLabel}</span>}
        </button>
      ))}
    </nav>
  )
}
