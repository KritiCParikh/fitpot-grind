import { useState } from 'react'
import MyCalendar from '../components/MyCalendar'
import ShareSheet from '../components/ShareSheet'
import { useWorkouts } from '../lib/privateData'

// My locker → My calendar: every day you worked out, in a group or not.
// Share my month (phase 5.14): the gullak card for this month.
export default function MyCalendarPage({ user }) {
  const workouts = useWorkouts(user.uid)
  const [sharing, setSharing] = useState(false)
  return (
    <section>
      <h2>My calendar</h2>
      <MyCalendar user={user} />
      <button type="button" className="btn-ghost wide share-month" onClick={() => setSharing(true)}>Share my month</button>
      {sharing && <ShareSheet user={user} mode="month" workouts={workouts || []} onClose={() => setSharing(false)} />}
    </section>
  )
}
