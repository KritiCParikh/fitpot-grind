import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tile, Safe } from '../nav/Hub'
import { useDrafts } from '../lib/drafts'

// My locker (phase 5.12): the home tab. Everything private to you, and it all
// works without a group: your calendar, Food, Training, Progress, Targets,
// and Drafts you haven't saved yet.
export default function LockerHome({ user }) {
  const navigate = useNavigate()
  const drafts = useDrafts(user.uid)
  const [safeNote, setSafeNote] = useState('')
  return (
    <section className="hub">
      <div className="hub-head">
        <h2>My locker</h2>
        <span className="muted small">Private to you</span>
      </div>
      <Tile big pageKey="mycal" user={user} />
      <div className="tiles">
        <Tile pageKey="food" user={user} />
        <Tile pageKey="training" user={user} />
        <Tile pageKey="progress" user={user} />
        <Tile pageKey="targets" user={user} />
      </div>
      <button type="button" className={`drafts-row ${drafts.length ? 'has' : ''}`} onClick={() => navigate('/locker/drafts')}>
        <strong>Drafts</strong>
        <span className="muted small">{drafts.length ? `${drafts.length} not saved yet. Pick up where you left off` : 'Nothing unsaved'}</span>
        {drafts.length > 0 && <span className="pill lime-pill">{drafts.length}</span>}
      </button>
      <Safe pageKey="scan" onTap={() => setSafeNote('Plate scan is being built in Phase 6. We\'ll let you know as soon as it\'s ready.')} />
      <Safe pageKey="plans" onTap={() => setSafeNote('My plan is being built in Phase 8. We\'ll let you know as soon as it\'s ready.')} />
      {safeNote && <p className="muted small" role="status">{safeNote}</p>}
    </section>
  )
}
