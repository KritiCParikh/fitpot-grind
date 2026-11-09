import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { HUBS, hubOf, SECTIONS } from './pages'

// The four bottom tabs (phase 5.12): Locker, Crew, Coach, Account. The tab
// for the area you're in is lit, on its home page and on every page inside it.
export default function BottomTabs({ current }) {
  const navigate = useNavigate()
  const on = hubOf(current)?.key
  return (
    <nav className="bottom-tabs" aria-label="Main">
      {HUBS.map((p) => (
        <button key={p.key} type="button" className={`tab-btn ${on === p.key ? 'on' : ''}`}
          aria-current={on === p.key ? 'page' : undefined} onClick={() => navigate(p.to)}>
          <Icon name={p.icon} size={26} />
          <span>{SECTIONS.find((s) => s.key === p.section)?.tab}</span>
        </button>
      ))}
    </nav>
  )
}
