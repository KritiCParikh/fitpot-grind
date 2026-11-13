// Every page in FitPot, in one place (phase 5.7, reorganised in 5.13 to
// match the navigation prototype). The bottom tabs, the locker room menu and
// swiping all read from this list, so adding a page later is one entry here.
//
// Four areas, one per bottom tab:
//   you      My locker: private to you, works without a group
//   crew     Crew: needs a group
//   coach    Coach: FitPot's own AI, being built
//   settings Account
//
// hub:   the area's home page (the bottom tab). Not repeated as a locker.
// swipe: order for swiping left/right between the four areas
// Pages with no `to` are being built and show as a safe in their area.
export const PAGES = [
  { key: 'locker', to: '/', label: 'My locker', section: 'you', hub: true, swipe: 0, icon: 'training' },
  { key: 'mycal', to: '/locker/calendar', label: 'My calendar', section: 'you', icon: 'calendar' },
  { key: 'food', to: '/locker?me=food', label: 'Food', section: 'you', icon: 'food', sub: true },
  { key: 'training', to: '/locker?me=training&t=log', label: 'Training', section: 'you', icon: 'training', sub: true },
  { key: 'progress', to: '/locker?me=progress', label: 'Progress', section: 'you', icon: 'progress', sub: true },
  { key: 'targets', to: '/locker?me=targets', label: 'Targets', section: 'you', icon: 'targets', sub: true },
  { key: 'drafts', to: '/locker/drafts', label: 'Drafts', section: 'you', icon: 'log' },
  { key: 'crew', to: '/crew', label: 'Crew', section: 'crew', hub: true, swipe: 1, icon: 'group' },
  { key: 'today', to: '/today', label: 'Today', section: 'crew', icon: 'today' },
  { key: 'chat', to: '/chat', label: 'Chat', section: 'crew', icon: 'chat' },
  { key: 'calendar', to: '/calendar', label: 'Calendar', section: 'crew', icon: 'calendar' },
  { key: 'wall', to: '/wall', label: 'Wall', section: 'crew', icon: 'wall' },
  { key: 'board', to: '/board', label: 'Board', section: 'crew', icon: 'board' },
  { key: 'group', to: '/group', label: 'Group', section: 'crew', icon: 'group' },
  { key: 'coach', to: '/coach', label: 'Coach', section: 'coach', hub: true, swipe: 2, icon: 'spark' },
  { key: 'account', to: '/account', label: 'Account', section: 'settings', hub: true, swipe: 3, icon: 'account' },
  // Being built. Each shows as a safe in its own area until it's ready.
  { key: 'scan', label: 'Food safe: Plate scan', section: 'you', icon: 'scan', note: 'Phase 6', what: 'Snap your plate, see what\'s on it' },
  { key: 'plans', label: 'Training safe: My plan', section: 'you', icon: 'plan', note: 'Phase 8', what: 'A plan to help you beat your records' },
  { key: 'recipes', label: 'Food safe: Recipe coach', section: 'you', icon: 'food', note: 'Phase 9', what: 'Recipes from what\'s in your kitchen, to fit your targets' },
  { key: 'nudges', label: 'Crew safe: AI nudges', section: 'crew', icon: 'spark', note: 'Phase 7', what: 'Friendly nudges for your crew' },
]

export const SECTIONS = [
  { key: 'you', label: 'My locker', note: 'Private to you', tab: 'Locker' },
  { key: 'crew', label: 'Crew', tab: 'Crew' },
  { key: 'coach', label: 'Coach', note: 'Being built', tab: 'Coach' },
  { key: 'settings', label: 'Account', tab: 'Account' },
]

export const SWIPE_ORDER = PAGES.filter((p) => p.swipe != null).sort((a, b) => a.swipe - b.swipe)
export const HUBS = SWIPE_ORDER

export const pageOf = (key) => PAGES.find((p) => p.key === key)
/** The area's home page for any page, e.g. 'wall' → the Crew hub. */
export const hubOf = (key) => {
  const s = pageOf(key)?.section || 'you'
  return PAGES.find((p) => p.hub && p.section === s)
}

/** Which page is showing, from the router location. */
export function currentKey(pathname, search) {
  if (pathname === '/locker') {
    const me = new URLSearchParams(search).get('me')
    return me && PAGES.some((p) => p.key === me) ? me : 'food'
  }
  return PAGES.find((p) => p.to === pathname)?.key || 'locker'
}
