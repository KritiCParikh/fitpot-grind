import { local } from '../lib/device'

// Text size for the whole app (Account, Text size). Everything is sized in
// rem, so changing the root size scales all text and spacing together.
export const TEXT_SIZES = [
  { key: 'normal', label: 'Normal', px: 17 },
  { key: 'large', label: 'Large', px: 19 },
  { key: 'xl', label: 'Extra large', px: 21 },
]
export const getTextSize = () => local.get('fitpot-text') || 'normal'
export function applyTextSize(key = getTextSize()) {
  const s = TEXT_SIZES.find((t) => t.key === key) || TEXT_SIZES[0]
  document.documentElement.style.fontSize = `${s.px}px`
  local.set('fitpot-text', s.key)
}
