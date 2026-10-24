export default function MeSummary({ user }) {
  return (
    <div className="me-summary card">
      <h3 className="lime">{user.displayName || 'You'}</h3>
      <p className="muted small">1 training day this week</p>
    </div>
  )
}
