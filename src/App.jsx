import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider, isConfigured } from './firebase'

function SetupNotice() {
  return (
    <main className="center">
      <h1 className="logo">FitPot</h1>
      <p className="muted">Firebase isn't configured yet.</p>
      <p className="muted small">
        Copy <code>.env.example</code> to <code>.env.local</code> and add your Firebase web config.
        See the README for the full setup.
      </p>
    </main>
  )
}

function Login() {
  const [error, setError] = useState('')
  return (
    <main className="center">
      <h1 className="logo">FitPot</h1>
      <p className="tagline">Show up or pay up.</p>
      <button
        className="btn-primary"
        onClick={() => signInWithPopup(auth, googleProvider).catch((e) => setError(e.message))}
      >
        Sign in with Google
      </button>
      {error && <p className="error small">{error}</p>}
    </main>
  )
}

function Today({ user }) {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  return (
    <section>
      <p className="muted">{today}</p>
      <h2>Hey {user.displayName?.split(' ')[0] || 'there'}</h2>
      <div className="card today-card">
        <p className="muted small">Today's check-in</p>
        <button className="checkin-btn" disabled>CHECK IN</button>
        <p className="muted small">Check-ins arrive in the next build.</p>
      </div>
    </section>
  )
}

function ComingSoon({ title }) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="card"><p className="muted">Coming in a later phase.</p></div>
    </section>
  )
}

function Shell({ user }) {
  return (
    <div className="shell">
      <header className="topbar">
        <span className="logo small-logo">FitPot</span>
        <button className="btn-ghost" onClick={() => signOut(auth)}>Sign out</button>
      </header>
      <div className="content">
        <Routes>
          <Route path="/" element={<Today user={user} />} />
          <Route path="/calendar" element={<ComingSoon title="Calendar" />} />
          <Route path="/wall" element={<ComingSoon title="Photo wall" />} />
          <Route path="/board" element={<ComingSoon title="Leaderboard" />} />
          <Route path="/group" element={<ComingSoon title="Group" />} />
        </Routes>
      </div>
      <nav className="tabbar">
        <NavLink to="/" end>Today</NavLink>
        <NavLink to="/calendar">Calendar</NavLink>
        <NavLink to="/wall">Wall</NavLink>
        <NavLink to="/board">Board</NavLink>
        <NavLink to="/group">Group</NavLink>
      </nav>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, setUser)
  }, [])

  if (!isConfigured) return <SetupNotice />
  if (user === undefined) return <main className="center"><p className="muted">Loading…</p></main>
  if (!user) return <Login />

  // HashRouter keeps routing working on GitHub Pages (no server-side rewrites).
  return (
    <HashRouter>
      <Shell user={user} />
    </HashRouter>
  )
}
