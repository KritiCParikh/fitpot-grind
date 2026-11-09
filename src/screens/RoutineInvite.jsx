import { useParams, Link } from 'react-router-dom'
import { parseRoutineLink } from '../lib/chat'
import { RoutineCard } from '../components/RoutineShare'

// A routine someone shared by link (phase 5.15): #/r/<data>.
export default function RoutineInvite({ user }) {
  const { data } = useParams()
  const routine = parseRoutineLink(data || '')
  return (
    <section>
      <h2>A routine for you</h2>
      {routine ? (
        <>
          <p className="muted small">{routine.curatedByName ? `${routine.curatedByName} shared this with you.` : 'Someone shared this with you.'} Add it to your locker to use it any time, or try it once.</p>
          <RoutineCard user={user} routine={routine} standalone />
        </>
      ) : (
        <div className="card"><p>This link doesn't open a routine. Ask your friend to share it again.</p><Link className="btn-ghost" to="/">Go to My locker</Link></div>
      )}
    </section>
  )
}
