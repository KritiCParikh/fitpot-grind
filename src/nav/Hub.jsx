import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import PageStat from './PageStat'
import { hubOf, pageOf } from './pages'

// Building blocks for the area home pages (phase 5.12): big tiles with a live
// line under each name, safes for what's being built, and a Back link.

export function Tile({ pageKey, user, big, label, sub, to }) {
  const navigate = useNavigate()
  const p = pageOf(pageKey) || {}
  return (
    <button type="button" className={`tile ${big ? 'big' : ''}`} onClick={() => navigate(to || p.to)}>
      <span className="tile-icon"><Icon name={p.icon} size={big ? 28 : 26} /></span>
      <span className="tile-text">
        <span className="tile-name">{label || p.label}</span>
        <span className="tile-sub">{sub ?? <PageStat pageKey={pageKey} user={user} />}</span>
      </span>
    </button>
  )
}

export function Safe({ pageKey, onTap, showWhat }) {
  const p = pageOf(pageKey)
  return (
    <button type="button" className="safe-card" onClick={onTap} aria-label={`${p.label}, being built (${p.note})`}>
      <span className="safe-dial" aria-hidden="true" />
      <span>
        <strong>{p.label}</strong><br />
        <span className="orange small">Being built ({p.note})</span>
        {showWhat && p.what && <><br /><span className="muted small">{p.what}</span></>}
      </span>
    </button>
  )
}

/** "‹ Back to Crew" on every page inside an area. */
export function BackTo({ current }) {
  const navigate = useNavigate()
  const hub = hubOf(current)
  if (!hub || hub.key === current) return null
  return (
    <button type="button" className="back-to" onClick={() => navigate(hub.to)}>
      <span aria-hidden="true">‹</span> Back to {hub.label}
    </button>
  )
}
