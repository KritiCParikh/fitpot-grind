import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Tile, Safe } from '../nav/Hub'
import Tour from '../nav/Tour'
import { useDrafts } from '../lib/drafts'
import { useUserDoc } from '../hooks'
import { useSettings, saveSettings, useWorkouts, useRecentMeals } from '../lib/privateData'

// My locker (phase 5.12): the home tab. Everything private to you, and it all
// works without a group: your calendar, Food, Training, Progress, Targets,
// and Drafts you haven't saved yet.
// First time (phase 5.13): a simple start with three steps that tick
// themselves off, and a short guided tour that shows once. The extras
// (Drafts row, safes) stay out of the way until then.
export default function LockerHome({ user }) {
  const navigate = useNavigate()
  const drafts = useDrafts(user.uid)
  const settings = useSettings(user.uid)
  const [safeNote, setSafeNote] = useState('')
  const [touring, setTouring] = useState(false)
  if (settings === undefined) return <section className="hub"><p className="muted">Loading...</p></section>
  const s = settings || {}
  const newbie = !s.welcomeHidden
  const showTour = touring || !s.tourDone
  const endTour = () => { setTouring(false); if (!s.tourDone) saveSettings(user.uid, { tourDone: true }) }

  return (
    <section className="hub">
      <div className="hub-head">
        <h2>My locker</h2>
        <span className="muted small">Private to you</span>
      </div>
      {newbie && <Welcome user={user} onTour={() => setTouring(true)} onHide={() => saveSettings(user.uid, { welcomeHidden: true })} />}
      <Tile big pageKey="mycal" user={user} />
      <div className="tiles">
        <Tile pageKey="food" user={user} />
        <Tile pageKey="training" user={user} />
        <Tile pageKey="progress" user={user} />
        <Tile pageKey="targets" user={user} />
      </div>
      {(drafts.length > 0 || !newbie) && (
        <button type="button" className={`drafts-row ${drafts.length ? 'has' : ''}`} onClick={() => navigate('/locker/drafts')}>
          <strong>Drafts</strong>
          <span className="muted small">{drafts.length ? `${drafts.length} not saved yet. Pick up where you left off` : 'Nothing unsaved'}</span>
          {drafts.length > 0 && <span className="pill lime-pill">{drafts.length}</span>}
        </button>
      )}
      {!newbie && (
        <>
          <Safe pageKey="scan" onTap={() => setSafeNote('Plate scan is being built in Phase 6. We\'ll let you know as soon as it\'s ready.')} />
          <Safe pageKey="plans" onTap={() => setSafeNote('My plan is being built in Phase 8. We\'ll let you know as soon as it\'s ready.')} />
          {safeNote && <p className="muted small" role="status">{safeNote}</p>}
        </>
      )}
      {showTour && <Tour onDone={endTour} />}
    </section>
  )
}

// Simple start: three steps that tick off on their own.
function Welcome({ user, onTour, onHide }) {
  const profile = useUserDoc(user.uid)
  const workouts = useWorkouts(user.uid)
  const meals = useRecentMeals(user.uid)
  const name = (user.displayName || '').split(' ')[0]
  const steps = [
    { done: (workouts || []).length > 0, label: 'Log a workout', sub: 'Gym, a run, a game of cricket, anything', to: '/locker?me=training&t=log' },
    { done: (profile?.groupIds || []).length > 0 || Boolean(profile?.groupId), label: 'Join or start a crew', sub: 'Check in together. Show up or pay up', to: '/group' },
    { done: (meals || []).length > 0, label: 'Track a meal (optional)', sub: 'Katori, roti, cup: no scale needed', to: '/locker?me=food' },
  ]
  const left = steps.filter((x) => !x.done).length
  return (
    <div className="card welcome">
      <p className="welcome-title"><strong>Welcome{name ? `, ${name}` : ''}!</strong> {left ? 'Getting started:' : 'You\'re all set.'}</p>
      <ol className="welcome-steps">
        {steps.map((x) => (
          <li key={x.label} className={x.done ? 'done' : ''}>
            <span className="welcome-tick" aria-hidden="true">{x.done ? '✓' : ''}</span>
            {x.done
              ? <span className="grow-col"><span>{x.label}</span><span className="muted small">Done</span></span>
              : <Link className="grow-col" to={x.to}><span>{x.label}</span><span className="muted small">{x.sub}</span></Link>}
          </li>
        ))}
      </ol>
      <div className="action-row">
        <button type="button" className="btn-ghost" onClick={onTour}>Take the tour</button>
        <button type="button" className="btn-ghost" onClick={onHide}>{left ? 'Hide this' : 'Done'}</button>
      </div>
    </div>
  )
}
