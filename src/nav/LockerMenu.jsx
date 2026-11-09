import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PAGES, SECTIONS, hubOf } from './pages'
import Icon from './Icon'
import { useGroupCtx } from '../groupContext'

// The locker room (phase 5.12, after the navigation prototype): the menu
// behind the three lines, top left. One row per area: My locker, Crew, Coach,
// Account. My locker and Crew open down to their pages, with the safes being
// built under their homes. The area you're in starts open and lit.
export default function LockerMenu({ user, current, onClose, groupSwitch }) {
  const navigate = useNavigate()
  const { status, group } = useGroupCtx()
  const area = hubOf(current)?.section || 'you'
  const [open, setOpen] = useState(area === 'crew' ? 'crew' : 'you')
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [onClose])

  function go(to) {
    navigate(to)
    onClose()
  }
  const name = (user.displayName || '').split(' ')[0] || 'You'
  const viewing = status === 'ready' ? `${name}, viewing ${group.name}` : `${name}, no group yet`

  return (
    <div className="locker-room" role="dialog" aria-modal="true" aria-label="Locker room menu">
      <div className="room-head">
        <span className="room-title">
          <strong>Locker room</strong>
          <span className="muted small">{viewing}</span>
        </span>
        <button className="icon-btn" onClick={onClose} aria-label="Close menu"><Icon name="close" /></button>
      </div>
      <div className="room-list">
        {SECTIONS.map((s) => {
          const hub = PAGES.find((p) => p.hub && p.section === s.key)
          const pages = PAGES.filter((p) => p.section === s.key && p.to && !p.hub)
          const expands = pages.length > 0
          const isOpen = expands && open === s.key
          const lit = area === s.key
          return (
            <div key={s.key} className="room-area">
              <button type="button" className={`room-row ${lit ? 'on' : ''}`} aria-expanded={expands ? isOpen : undefined}
                onClick={() => (expands ? setOpen(isOpen ? null : s.key) : go(hub.to))}>
                <Icon name={hub.icon} size={24} />
                <span className="grow">{s.label}</span>
                {s.key === 'coach' && <span className="orange small room-soon">Being built</span>}
                {s.key !== 'coach' && (
                  <span className={`room-chev ${isOpen ? 'up' : ''}`} aria-hidden="true">
                    <Icon name={expands ? 'chevron' : 'chevronRight'} size={22} />
                  </span>
                )}
              </button>
              {isOpen && (
                <div className="room-sub">
                  {s.key === 'crew' && groupSwitch && <div className="room-switch">{groupSwitch}</div>}
                  {pages.map((p) => (
                    <div key={p.key}>
                      <button type="button" className={`room-item ${current === p.key ? 'on' : ''}`}
                        aria-current={current === p.key ? 'page' : undefined} onClick={() => go(p.to)}>{p.label}</button>
                      {SOON[p.key] && <SoonRow pageKey={SOON[p.key]} onTap={() => go('/coach')} />}
                    </div>
                  ))}
                  {s.key === 'crew' && (
                    <>
                      <button type="button" className="room-item" onClick={() => go('/group')}>+ Join or create a group</button>
                      <SoonRow pageKey="nudges" onTap={() => go('/coach')} />
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// What's being built, under the page it belongs to.
const SOON = { food: 'scan', training: 'plans' }
const SHORT = { scan: 'Plate scan', plans: 'My plan', nudges: 'AI nudges' }

function SoonRow({ pageKey, onTap }) {
  const p = PAGES.find((x) => x.key === pageKey)
  return (
    <button type="button" className="room-item soon" onClick={onTap} aria-label={`${SHORT[pageKey]}, being built (${p.note})`}>
      <span>{SHORT[pageKey]}</span>
      <span className="orange small">{p.note}</span>
    </button>
  )
}
