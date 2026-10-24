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
import Mark from './nav/Mark'
import BottomTabs from './nav/BottomTabs'
import MeSummary from './components/MeSummary'
import Tile from './components/Tile'
import SafeCard from './components/SafeCard'

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
  const groupIds = [...new Set([...(profile?.groupIds || []), profile?.groupId].filter(Boolean))]
  const activeId = profile?.groupId || null
  const meta = useGroupsMeta(groupIds)
  const base = { user, groupIds, meta }
  const [menu, setMenu] = useState(false)
  const [activeTab, setActiveTab] = useState('locker')
  const loc = useLocation()
  const current = currentKey(loc.pathname, loc.search)

  return (
    <GroupProvider key={activeId || 'none'} user={user} groupId={activeId}>
      <div className="shell">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu}>
            <Icon name="menu" size={26} />
          </button>
          <span className="brand"><Mark size={28} /><span className="logo small-logo">FitPot</span></span>
          <GroupSwitcher user={user} groupIds={groupIds} activeId={activeId} meta={meta} />
          <QuickCheck user={user} />
        </header>
        <OfflineBar />
        <div className="content">
          {activeTab === 'locker' && (
            <section className="me-page">
              <h2>Me</h2>
              <MeSummary user={user} />
              <div className="tiles-grid">
                <Tile to="/?me=food" label="Food" icon="food" />
                <Tile to="/?me=training" label="Training" icon="training" />
                <Tile to="/?me=progress" label="Progress" icon="progress" />
                <Tile to="/?me=targets" label="Targets" icon="targets" />
              </div>
              <h3 className="section-title">Food safe</h3>
              <SafeCard label="Food safe: Plate scan" phase="Phase 6" />
              <h3 className="section-title">Training safe</h3>
              <SafeCard label="Training safe: My plan" phase="Phase 8" />
            </section>
          )}

          {activeTab === 'crew' && (
            <section>
              <h2>Crew</h2>
              <GroupSwitcher user={user} groupIds={groupIds} activeId={activeId} meta={meta} />
              <div className="tiles-grid">
                <Tile to="/today" label="Today" icon="today" />
                <Tile to="/calendar" label="Calendar" icon="calendar" />
                <Tile to="/wall" label="Wall" icon="wall" />
                <Tile to="/board" label="Board" icon="board" />
                <Tile to="/group" label="Group" icon="group" />
                <Tile to="/group" label="Join or create" icon="add" />
              </div>
              <SafeCard label="Crew safe: AI nudges" phase="Phase 7" />
            </section>
          )}

          {activeTab === 'coach' && (
            <section>
              <h2>Coach</h2>
              <div className="card">
                <p className="muted">Coming soon in Phase 7.</p>
              </div>
            </section>
          )}

          {activeTab === 'account' && <Account user={user} groupIds={groupIds} profile={profile} />}
        </div>
        <BottomTabs activeTab={activeTab} onTabChange={setActiveTab} />
        {menu && <LockerMenu user={user} current={current} onClose={() => setMenu(false)}
          groupSwitch={<GroupSwitcher user={user} groupIds={groupIds} activeId={activeId} meta={meta} />} />}
      </div>
    </GroupProvider>
  )
}

function SignedIn({ user }) {
  const profile = useUserDoc(user.uid)
  if (profile === undefined) return <Loading />
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
