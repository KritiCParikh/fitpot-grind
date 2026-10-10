// Every page in FitPot, in one place (phase 5.7). The menu, the bottom bar
// and swiping all read from this list, so adding a page later (an AI coach,
// a plan builder) is one entry here.
//
// section: 'you' (private), 'crew' (needs a group), 'settings'. Pages with no
// `to` are being built and show as a safe in their section.
// swipe:   order for swiping left/right between the main pages
export const PAGES = [
  { key: 'me', to: '/', label: 'Me', section: 'you', swipe: 0, icon: 'me' },
  { key: 'food', to: '/?me=food', label: 'Food', section: 'you', icon: 'food', sub: true },
  { key: 'training', to: '/?me=training&t=log', label: 'Training', section: 'you', icon: 'training', sub: true },
  { key: 'progress', to: '/?me=progress', label: 'Progress', section: 'you', icon: 'progress', sub: true },
  { key: 'targets', to: '/?me=targets', label: 'Targets', section: 'you', icon: 'targets', sub: true },
  { key: 'today', to: '/today', label: 'Today', section: 'crew', swipe: 1, icon: 'today' },
  { key: 'calendar', to: '/calendar', label: 'Calendar', section: 'crew', swipe: 2, icon: 'calendar' },
  { key: 'wall', to: '/wall', label: 'Wall', section: 'crew', swipe: 3, icon: 'wall' },
  { key: 'board', to: '/board', label: 'Board', section: 'crew', swipe: 4, icon: 'board' },
  { key: 'group', to: '/group', label: 'Group', section: 'crew', swipe: 5, icon: 'group' },
  { key: 'account', to: '/account', label: 'Account', section: 'settings', icon: 'account' },
  // Being built. Each shows as a safe in its own area until it's ready.
  { key: 'scan', label: 'Food safe: Plate scan', section: 'you', icon: 'scan', note: 'Phase 6' },
  { key: 'plans', label: 'Training safe: My plan', section: 'you', icon: 'plan', note: 'Phase 8' },
  { key: 'coach', label: 'Crew safe: AI nudges', section: 'crew', icon: 'spark', note: 'Phase 7' },
]

export const SECTIONS = [
  { key: 'you', label: 'My locker', note: 'Private to you' },
  { key: 'crew', label: 'Crew' },
  { key: 'settings', label: 'Settings' },
]

export const SWIPE_ORDER = PAGES.filter((p) => p.swipe != null).sort((a, b) => a.swipe - b.swipe)

/** Which page is showing, from the router location. */
export function currentKey(pathname, search) {
  if (pathname === '/' || pathname === '/me') {
    const me = new URLSearchParams(search).get('me')
    return me && PAGES.some((p) => p.key === me) ? me : 'me'
  }
  return PAGES.find((p) => p.to === pathname)?.key || 'me'
}
