import { useNavigate } from 'react-router-dom'
import { useDrafts, removeDraft, draftKindLabel } from '../lib/drafts'

const ago = (ms) => {
  const m = Math.round((Date.now() - ms) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

// My locker → Drafts (phase 5.12): workouts, routines, meals, foods and
// recipes you started and didn't save. Tap one to pick up where you left off.
export default function Drafts({ user }) {
  const navigate = useNavigate()
  const drafts = useDrafts(user.uid)
  return (
    <section>
      <h2>Drafts</h2>
      <p className="muted small">Anything you start in Food or Training is kept here as you type, until you save it. Kept on this phone only.</p>
      {!drafts.length ? (
        <div className="card"><p className="muted">Nothing unsaved. You're all caught up.</p></div>
      ) : (
        <ul className="member-list drafts-list">
          {drafts.map((d) => (
            <li key={d.id}>
              <button type="button" className="plain grow-col" onClick={() => navigate(d.to)}>
                <span className="muted small">{draftKindLabel(d.kind)} · {ago(d.savedAt)}</span>
                <strong>{d.title}</strong>
                {d.sub && <span className="muted small">{d.sub}</span>}
              </button>
              <button type="button" className="btn-ghost" onClick={() => navigate(d.to)}>Continue</button>
              <button type="button" className="btn-ghost x" aria-label={`Discard ${d.title}`}
                onClick={() => confirm(`Discard "${d.title}"? It can't be brought back.`) && removeDraft(user.uid, d.id)}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
