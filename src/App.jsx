import { useEffect, useMemo, useRef, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, isConfigured } from './firebase'
import { useUserDoc, useGroup, useMembers, useSubcollection, useGroupsMeta } from './hooks'
import { setActiveGroup, logTimezoneChange } from './lib/group'
import { makeClock, validChanges, localTz } from './lib/clock'
import { makeMoney } from './lib/money'
import { GroupCtx, useGroupCtx } from './groupContext'
import Today from './screens/Today'
import Calendar from './screens/Calendar'
import Group from './screens/Group'
import Board from './screens/Board'
import Wall from './screens/Wall'
import Me from './screens/Me'
import Login from './screens/Login'
import Account from './screens/Account'
import UpdateBar from './components/UpdateBar'
import Icon from './nav/Icon'
import LockerMenu from './nav/LockerMenu'
import QuickCheck from './nav/QuickCheck'
import useSwipe from './nav/useSwipe'
import { currentKey } from './nav/pages'
import OfflineBar from './components/OfflineBar'

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
  return <main className="center"><p className="muted">Loading...</p></main>
}

// If this phone's timezone differs from the one this group has for you, log
// the change once. It takes effect from your next day.
function useTimezoneWatch(user, group) {
  const sent = useRef('')
  useEffect(() => {
    if (!group?.clock || group.clock.hasLeft(user.uid)) return
    function check() {
      const phone = localTz()
      if (phone === group.clock.finalTz() || sent.current === phone) return
      sent.current = phone
      logTimezoneChange(user, group, phone).catch(() => { sent.current = '' })
    }
    check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [user, group])
}


// Loads the active group with its members, clock (each member's timezone) and
// money (currency). Keyed by group id, so switching groups starts fresh.
function GroupProvider({ user, groupId, children }) {
  const { group: raw, error } = useGroup(groupId)
  const members = useMembers(groupId)
  const tzDocs = useSubcollection(groupId, 'tzchanges')
  const currencyDocs = useSubcollection(groupId, 'currencies')

  const group = useMemo(() => {
    if (!raw || !members || !tzDocs || !currencyDocs) return null
    const clock = makeClock({ groupTz: raw.timezone, members, tzChanges: tzDocs, myUid: user.uid })
    const money = makeMoney({
      base: raw.currency || 'USD',
      changes: validChanges(currencyDocs, clock, ['currency', 'from', 'rate', 'penalty']),
      today: clock.today,
    })
    return { ...raw, clock, money }
  }, [raw, members, tzDocs, currencyDocs, user.uid])
  useTimezoneWatch(user, group)

  const status = !groupId ? 'none' : error || raw === null ? 'error' : group ? 'ready' : 'loading'
  return <GroupCtx.Provider value={{ status, group, members }}>{children}</GroupCtx.Provider>
}

// Group tabs (Today, Calendar, Wall, Board) need a group. Until you're in one,
// they invite you to join or create one.
function NeedGroup({ title, children }) {
  const { status, group, members } = useGroupCtx()
  if (status === 'ready') return children(group, members)
  return (
    <section>
      <h2>{title}</h2>
      {status === 'loading' ? <p className="muted">Loading...</p> : (
        <div className="card">
          <p>{status === 'error' ? 'Couldn\'t open this group. Pick another one in the Group tab.' : 'Join or create a group to see this.'}</p>
          <p className="muted small">Your Me tab works on its own. Groups add the daily check-in, the pot and your friends.</p>
          <Link className="btn-primary" to="/group">{status === 'error' ? 'Go to Group' : 'Join or create a group'}</Link>
        </div>
      )}
    </section>
  )
}

function GroupSwitcher({ user, groupIds, activeId, meta }) {
  if (!groupIds.length) return null
  return (
    <select className="group-switch" value={activeId || ''} aria-label="Switch group"
      onChange={(e) => setActiveGroup(user, e.target.value)}>
      {!activeId && <option value="">Choose a group</option>}
      {groupIds.map((id) => <option key={id} value={id}>{meta[id]?.name || '...'}</option>)}
    </select>
  )
}

function Shell({ user, profile }) {
  // All your groups. Older accounts only have `groupId`, so include it.
  const groupIds = [...new Set([...(profile?.groupIds || []), profile?.groupId].filter(Boolean))]
  const activeId = profile?.groupId || null
  const meta = useGroupsMeta(groupIds)
  const base = { user, groupIds, meta }
  const [menu, setMenu] = useState(false)
  const loc = useLocation()
  const current = currentKey(loc.pathname, loc.search)
  const swipe = useSwipe(current)

  return (
    <GroupProvider key={activeId || 'none'} user={user} groupId={activeId}>
      <div className="shell">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu}>
            <Icon name="menu" size={26} />
          </button>
          <span className="logo small-logo">FitPot</span>
          <GroupSwitcher user={user} groupIds={groupIds} activeId={activeId} meta={meta} />
          <QuickCheck user={user} />
        </header>
        <OfflineBar />
        <div className="content" {...swipe}>
          <Routes>
            <Route path="/" element={<Me user={user} />} />
            <Route path="/today" element={<NeedGroup title="Today">{(g, m) => <Today {...base} group={g} members={m} />}</NeedGroup>} />
            <Route path="/calendar" element={<NeedGroup title="Calendar">{(g, m) => <Calendar {...base} group={g} members={m} />}</NeedGroup>} />
            <Route path="/wall" element={<NeedGroup title="Photo wall">{(g, m) => <Wall {...base} group={g} members={m} />}</NeedGroup>} />
            <Route path="/board" element={<NeedGroup title="Board">{(g, m) => <Board {...base} group={g} members={m} />}</NeedGroup>} />
            <Route path="/group" element={<Group {...base} activeId={activeId} />} />
            <Route path="/account" element={<Account user={user} groupIds={groupIds} profile={profile} />} />
            <Route path="/me" element={<Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
        {menu && <LockerMenu user={user} current={current} onClose={() => setMenu(false)}
          groupSwitch={<GroupSwitcher user={user} groupIds={groupIds} activeId={activeId} meta={meta} />} />}
      </div>
    </GroupProvider>
  )
}

// After sign-in you land on Me. Groups are optional and can be added any time.
function SignedIn({ user }) {
  const profile = useUserDoc(user.uid)
  if (profile === undefined) return <Loading />
  // HashRouter keeps routing working on GitHub Pages (no server-side rewrites).
  return (
    <HashRouter>
      <Shell user={user} profile={profile} />
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
  return (
    <>
      {user ? <SignedIn key={user.uid} user={user} /> : <Login />}
      <UpdateBar />
    </>
  )
}
