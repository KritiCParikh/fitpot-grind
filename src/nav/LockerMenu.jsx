import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PAGES, SECTIONS } from './pages'
import Icon from './Icon'
import PageStat from './PageStat'

// The locker room: the full menu. Every page is a locker door with a live
// line under its name. My locker (Me) and Crew (with the group switcher),
// Settings, and a safe in each area for what's being built.
export default function LockerMenu({ user, current, onClose, groupSwitch }) {
  const navigate = useNavigate()
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [onClose])

  function open(to) {
    navigate(to)
    onClose()
  }

  return (
    <div className="locker-room" role="dialog" aria-modal="true" aria-label="All pages">
      <div className="locker-head">
        <strong>Locker room</strong>
        <button className="icon-btn" onClick={onClose} aria-label="Close menu"><Icon name="close" /></button>
      </div>
      {SECTIONS.map((s) => {
        const pages = PAGES.filter((p) => p.section === s.key && p.to)
        const safes = PAGES.filter((p) => p.section === s.key && !p.to)
        if (!pages.length && !safes.length) return null
        return (
          <section key={s.key} className="locker-section">
            <h3 className="section-title">
              {s.label}{s.note && <span className="section-note"> {s.note}</span>}
              {s.key === 'crew' && groupSwitch}
            </h3>
            {pages.length > 0 && (
              <div className={`lockers ${s.key === 'settings' ? 'wide' : ''}`}>
                {pages.map((p, i) => (
                  <button key={p.key} className={`locker ${current === p.key ? 'on' : ''}`}
                    style={{ animationDelay: `${i * 35}ms` }} onClick={() => open(p.to)}
                    aria-current={current === p.key ? 'page' : undefined}>
                    <span className="locker-vents" aria-hidden="true"><i /><i /><i /></span>
                    <span className="locker-icon"><Icon name={p.icon} size={26} /></span>
                    <span className="locker-name">{p.label}</span>
                    <span className="locker-stat"><PageStat pageKey={p.key} user={user} /></span>
                    <span className="locker-handle" aria-hidden="true" />
                  </button>
                ))}
                {s.key === 'crew' && (
                  <button className="locker join" onClick={() => open('/group')} style={{ animationDelay: `${pages.length * 35}ms` }}>
                    <span className="locker-icon" aria-hidden="true">+</span>
                    <span className="locker-stat">Join or create a group</span>
                  </button>
                )}
              </div>
            )}
            {safes.map((p) => (
              <div key={p.key} className="safe-card" aria-label={`${p.label}, being built`}>
                <span className="safe-dial" aria-hidden="true" />
                <span><strong>{p.label}</strong><br /><span className="orange small">Being built ({p.note})</span></span>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
