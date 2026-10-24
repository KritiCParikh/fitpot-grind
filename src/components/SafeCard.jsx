import { useState } from 'react'
import Icon from './Icon'

export default function SafeCard({ label, phase }) {
  const [show, setShow] = useState(false)

  return (
    <button
      className="safe-card"
      onClick={() => setShow(true)}
      onBlur={() => setShow(false)}
      aria-label={label}
    >
      <Icon name="dial" size={20} />
      <span className="safe-label">{label}</span>
      <span className="orange">{phase}</span>
      {show && <div className="safe-note">Coming soon in {phase}.</div>}
    </button>
  )
}
