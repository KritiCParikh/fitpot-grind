import { useEffect, useLayoutEffect, useState } from 'react'

// A short guided tour (phase 5.13) for first-time users: it points at one
// thing at a time with a line on what it's for. Steps whose target isn't on
// screen (e.g. Check in without a group) are skipped. onDone runs on Finish
// or Skip, so it shows only once.
export const TOUR_STEPS = [
  { sel: '.tile.big', title: 'My calendar', text: 'Every day you work out lights up here, with a crew or without one.' },
  { sel: '.tiles', title: 'Your locker', text: 'Food, Training, Progress and Targets. All private to you.' },
  { sel: '.quick-check', title: 'Check in', text: 'Worked out? Tap here. Your crew sees it, and that\'s what the pot counts.' },
  { sel: '.bottom-tabs .tab-btn:nth-child(2)', title: 'Crew', text: 'Your group: today, calendar, photo wall and the board. Show up or pay up.' },
  { sel: '.bottom-tabs .tab-btn:nth-child(3)', title: 'Coach', text: 'FitPot\'s own coach, being built. Plate scan, training plans and kind nudges.' },
  { sel: '.bottom-tabs .tab-btn:nth-child(4)', title: 'Account', text: 'About me, units (kg or lb), reminders and text size.' },
  { sel: '.menu-btn', title: 'Locker room', text: 'Every page in one menu, any time.' },
]

export default function Tour({ onDone, steps = TOUR_STEPS }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const [ready, setReady] = useState(false)
  // Wait a moment so buttons that load later (Check in) are counted from the start.
  useEffect(() => { const t = setTimeout(() => setReady(true), 700); return () => clearTimeout(t) }, [])
  const [live, setLive] = useState([])
  useEffect(() => { if (ready) setLive(steps.filter((s) => document.querySelector(s.sel))) }, [ready, steps])
  const step = live[i]

  useLayoutEffect(() => {
    if (!step) return
    const el = document.querySelector(step.sel)
    el?.scrollIntoView?.({ block: 'center', behavior: 'instant' })
    const place = () => { const r = el?.getBoundingClientRect(); if (r) setRect({ top: r.top, left: r.left, width: r.width, height: r.height }) }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [step])

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onDone()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onDone])

  if (!ready || !step || !rect) return null
  const pad = 6
  const below = rect.top + rect.height + 180 < window.innerHeight
  const last = i === live.length - 1
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={`Tour, step ${i + 1} of ${live.length}: ${step.title}`}>
      <div className="tour-hole" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      <div className="tour-card" style={below ? { top: rect.top + rect.height + 14 } : { bottom: window.innerHeight - rect.top + 14 }}>
        <p className="muted small">{i + 1} of {live.length}</p>
        <strong>{step.title}</strong>
        <p>{step.text}</p>
        <div className="action-row">
          <button type="button" className="btn-ghost" onClick={onDone}>{last ? 'Close' : 'Skip tour'}</button>
          {i > 0 && <button type="button" className="btn-ghost" onClick={() => setI(i - 1)}>Back</button>}
          <button type="button" className="btn-primary" onClick={() => (last ? onDone() : setI(i + 1))} autoFocus>{last ? 'Let\'s go' : 'Next'}</button>
        </div>
      </div>
    </div>
  )
}
