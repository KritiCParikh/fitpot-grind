import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider, isConfigured } from './firebase'
import { useUserDoc, useGroup, useMembers } from './hooks'
import { leaveGroupLocally } from './lib/group'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import Calendar from './screens/Calendar'
import Group from './screens/Group'
import Board from './screens/Board'
import Wall from './screens/Wall'

function SetupNotice() {
  return (
    <main className="center">
      <h1 className="logo">FitPot</h1>
      <p className="muted">Firebase isn't configured yet.</p>
      <p className="muted small">
        Add the Firebase values as repository secrets and re-run the deploy. See docs/BUILD_GUIDE.md.
      </p>
    </main>
  )
}

function Loading() {
  return <main className="center"><p className="muted">Loading…</p></main>
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


function Shell({ user, group, members }) {
  const props = { user, group, members }
  return (
    <div className="shell">
      <header className="topbar">
        <span className="logo small-logo">FitPot</span>
        <button className="btn-ghost" onClick={() => signOut(auth)}>Sign out</button>
      </header>
      <div className="content">
        <Routes>
          <Route path="/" element={<Today {...props} />} />
          <Route path="/calendar" element={<Calendar {...props} />} />
          <Route path="/wall" element={<Wall {...props} />} />
          <Route path="/board" element={<Board {...props} />} />
          <Route path="/group" element={<Group {...props} />} />
          <Route path="*" element={<Navigate to="/" />} />
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

function SignedIn({ user }) {
  const profile = useUserDoc(user.uid)
  if (profile === undefined) return <Loading />
  if (!profile?.groupId) return <Onboarding user={user} />
  // key: switching groups remounts and resets all group subscriptions.
  return <GroupScope key={profile.groupId} user={user} groupId={profile.groupId} />
}

function GroupScope({ user, groupId }) {
  const { group, error } = useGroup(groupId)
  const members = useMembers(groupId)

  if (error || group === null) {
    return (
      <main className="center">
        <p className="muted">Couldn't open your group.</p>
        <button className="btn-primary" onClick={() => leaveGroupLocally(user)}>Choose a group</button>
      </main>
    )
  }
  if (!group || !members) return <Loading />

  // HashRouter keeps routing working on GitHub Pages (no server-side rewrites).
  return (
    <HashRouter>
      <Shell user={user} group={group} members={members} />
    </HashRouter>
  )
}

export default function App() {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, setUser)
  }, [])

  if (!isConfigured) return <SetupNotice />
  if (user === undefined) return <Loading />
  if (!user) return <Login />
  return <SignedIn key={user.uid} user={user} />
}
