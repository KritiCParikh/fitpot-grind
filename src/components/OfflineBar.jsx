import { useOnline } from '../lib/device'

// Shown while there's no connection. Your data still opens and anything you
// log (food, workouts, weight) syncs when you're back online.
export default function OfflineBar() {
  if (useOnline()) return null
  return (
    <div className="offline-bar" role="status">
      You're offline. What you log is saved on this phone and syncs when you're back online. Check-ins and photos need a connection.
    </div>
  )
}
