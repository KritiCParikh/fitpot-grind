import MyCalendar from '../components/MyCalendar'

// My locker → My calendar: every day you worked out, in a group or not.
export default function MyCalendarPage({ user }) {
  return (
    <section>
      <h2>My calendar</h2>
      <MyCalendar user={user} />
    </section>
  )
}
