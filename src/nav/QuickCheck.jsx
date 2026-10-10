import { useNavigate } from 'react-router-dom'
import { useDayDocs } from '../hooks'
import { useGroupCtx } from '../groupContext'

// Always-visible Check in button in the header. Shows "In" once you've
// checked in today, so a glance between sets is enough.
export default function QuickCheck({ user }) {
  const { status, group } = useGroupCtx()
  const navigate = useNavigate()
  const checkins = useDayDocs(status === 'ready' ? group.id : null, 'checkins', status === 'ready' ? group.clock.today() : null)
  if (status !== 'ready') return null
  const done = (checkins || []).some((c) => c.uid === user.uid)
  return (
    <button className={`quick-check ${done ? 'done' : ''}`} onClick={() => navigate('/today')}
      aria-label={done ? 'Checked in today. Open Today' : 'Check in'}>
      {done ? '✓ In' : 'Check in'}
    </button>
  )
}
