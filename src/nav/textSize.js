import { local } from '../lib/device'

// Text size for the whole app (Account, Text size). Everything is sized in
// rem, so changing the root size scales all text and spacing together.
// Phase 5.16: pick from 50% to 130%, whatever is comfortable. 100% (Regular)
// is 16px. At Regular and above, narrow screens (or a phone set to bigger
// system text, which makes the page narrower) ease down a little so boxes
// stay inside the screen; the smaller sizes are used exactly as chosen.
const BASE_PX = 16
export const TEXT_SIZES = [
  { key: '50', pct: 50 },
  { key: '60', pct: 60 },
  { key: '70', pct: 70 },
  { key: '80', pct: 80, label: 'Small' },
  { key: '90', pct: 90 },
  { key: '100', pct: 100, label: 'Regular' },
  { key: '115', pct: 115, label: 'Large' },
  { key: '130', pct: 130, label: 'Extra large' },
]
// Sizes saved before 5.16 (Normal, Large, Extra large).
const OLD = { normal: '100', large: '115', xl: '130' }
const FULL_WIDTH = 390 // the phone width the layout is drawn for
const MIN_FIT = 0.84

export const getTextSize = () => {
  const k = local.get('fitpot-text') || '100'
  return OLD[k] || (TEXT_SIZES.some((t) => t.key === k) ? k : '100')
}

function rootPx(pct) {
  const px = BASE_PX * pct / 100
  if (pct < 100) return px
  const w = window.innerWidth || FULL_WIDTH
  const fit = Math.max(MIN_FIT, Math.min(1, w / FULL_WIDTH))
  return Math.round(Math.max(BASE_PX * MIN_FIT, px * fit) * 10) / 10
}

let listening = false
export function applyTextSize(key = getTextSize()) {
  const s = TEXT_SIZES.find((t) => t.key === key) || TEXT_SIZES.find((t) => t.key === '100')
  document.documentElement.style.fontSize = `${rootPx(s.pct)}px`
  local.set('fitpot-text', s.key)
  if (!listening) {
    listening = true
    window.addEventListener('resize', () => applyTextSize())
  }
}
