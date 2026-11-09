// Shown at the bottom of a form that's being kept as a draft.
export default function DraftNote({ kept, onDiscard }) {
  if (!kept) return null
  return (
    <p className="draft-note muted small">
      Not saved yet. It's kept in My locker → Drafts until you save it.
      {onDiscard && <> <button type="button" className="link-btn" onClick={onDiscard}>Discard draft</button></>}
    </p>
  )
}
