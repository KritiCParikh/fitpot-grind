import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { HUBS, hubOf, SECTIONS } from './pages'

// The four bottom tabs (phase 5.12): Locker, Crew, Coach, Account. The tab
// for the area you're in is lit, on its home page and on every page inside it.
// badges (phase 5.16): { crew: n } new chat messages, shown as a small count.
export default function BottomTabs({ current, badges = {} }) {
  const navigate = useNavigate()
  const on = hubOf(current)?.key
  return (
    <nav className="bottom-tabs" aria-label="Main">
      {HUBS.map((p) => (
        <button key={p.key} type="button" className={`tab-btn ${on === p.key ? 'on' : ''}`}
          aria-current={on === p.key ? 'page' : undefined} onClick={() => navigate(p.to)}
          aria-label={badges[p.key] ? `${SECTIONS.find((s) => s.key === p.section)?.tab}, ${badges[p.key]} new message${badges[p.key] === 1 ? '' : 's'}` : undefined}>
          <Icon name={p.icon} size={26} />
          {badges[p.key] > 0 && <i className="chat-tab-badge" aria-hidden="true">{badges[p.key] > 9 ? '9+' : badges[p.key]}</i>}
          <span>{SECTIONS.find((s) => s.key === p.section)?.tab}</span>
        </button>
      ))}
    </nav>
  )
}
