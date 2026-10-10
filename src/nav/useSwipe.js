import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { SWIPE_ORDER } from './pages'

// Swipe left or right across a page to move between Me, Today, Calendar,
// Wall, Board and Group. Ignored on things that scroll sideways themselves
// (photo tiles, chips, inputs) and on short or mostly vertical moves.
const SKIP = '.photo-strip, .chips, input, textarea, select, .set-grid, .chart-wrap, .sheet, .overlay, [data-noswipe]'

export default function useSwipe(currentKey) {
  const navigate = useNavigate()
  const start = useRef(null)
  const base = currentKey && SWIPE_ORDER.some((p) => p.key === currentKey) ? currentKey : 'me'
  const i = SWIPE_ORDER.findIndex((p) => p.key === base)
  return {
    onTouchStart(e) {
      const t = e.touches[0]
      start.current = e.target.closest(SKIP) ? null : { x: t.clientX, y: t.clientY, at: Date.now() }
    },
    onTouchEnd(e) {
      const s = start.current
      start.current = null
      if (!s) return
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x, dy = t.clientY - s.y
      if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - s.at > 600) return
      const next = SWIPE_ORDER[i + (dx < 0 ? 1 : -1)]
      if (next) navigate(next.to)
    },
  }
}
