import { Safe } from '../nav/Hub'

// Coach (phase 5.12): FitPot's own coach, built in house. Each safe also
// sits under its home (My locker or Crew) until it's ready.
export default function Coach() {
  return (
    <section className="hub">
      <div className="hub-head"><h2>Coach</h2></div>
      <p className="muted">Your own FitPot coach, built in house. Each of these also sits under its home in My locker or Crew.</p>
      <div className="safes">
        <Safe pageKey="scan" showWhat />
        <Safe pageKey="plans" showWhat />
        <Safe pageKey="nudges" showWhat />
      </div>
    </section>
  )
}
