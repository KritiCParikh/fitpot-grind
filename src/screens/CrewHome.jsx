import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Tile, Safe } from '../nav/Hub'
import { useGroupCtx } from '../groupContext'

// Crew (phase 5.12): everything you share with a group, with the switcher
// for which group you're looking at. Without a group, it invites you to join.
export default function CrewHome({ user, groupSwitch }) {
  const { status } = useGroupCtx()
  const [note, setNote] = useState('')
  return (
    <section className="hub">
      <div className="hub-head">
        <h2>Crew</h2>
        {groupSwitch}
      </div>
      {status === 'none' && (
        <div className="card">
          <p>Join or create a group to check in together, share photos and play for the pot.</p>
          <p className="muted small">My locker keeps working on its own, group or not.</p>
          <Link className="btn-primary" to="/group">Join or create a group</Link>
        </div>
      )}
      <div className="tiles">
        <Tile pageKey="today" user={user} />
        <Tile pageKey="chat" user={user} />
        <Tile pageKey="calendar" user={user} />
        <Tile pageKey="wall" user={user} />
        <Tile pageKey="board" user={user} />
        <Tile pageKey="group" user={user} />
        <Link className="tile join" to="/group"><span className="tile-plus" aria-hidden="true">+</span><span className="tile-sub">Join or create a group</span></Link>
      </div>
      <Safe pageKey="nudges" onTap={() => setNote('AI nudges are being built in Phase 7. We\'ll let you know as soon as they\'re ready.')} />
      {note && <p className="muted small" role="status">{note}</p>}
    </section>
  )
}
