import { useEffect, useMemo, useRef, useState } from 'react'
import { useWeights } from '../lib/privateData'
import { useMyDays } from '../lib/myDays'
import { setsByRegion } from '../lib/training'
import { workoutSummary, daysContext, kindLines, prText, monthSummary } from '../lib/share'
import { drawCard, loadCardFonts, cardFile, STYLES } from '../lib/shareCard'
import { prettyDay } from '../lib/dates'
import { myToday } from '../lib/clock'

// Share your session (phase 5.14). After saving a workout (or from My
// calendar for the month), FitPot draws a card on the phone: the gullak
// filling with this month's days, your body with the muscles you trained, or
// your week. Share it to any app, save it to your gallery, or close it.
// Nothing is posted anywhere unless you choose to share it.
//
// mode 'workout': workout = the saved workout (with id), prs = records it set
// mode 'month':   workouts = all of yours
export default function ShareSheet({ user, mode = 'workout', workout, workouts = [], prs = [], u, onClose }) {
  const weights = useWeights(user.uid)
  const { days: liveDays } = useMyDays(user)
  const canvasRef = useRef(null)
  const [style, setStyle] = useState('gullak')
  const [format, setFormat] = useState('post')
  const [background, setBackground] = useState('dark')
  const [lineIdx, setLineIdx] = useState(0)
  const [showName, setShowName] = useState(false)
  const [fontsReady, setFontsReady] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { loadCardFonts().then(() => setFontsReady(true)) }, [])

  const today = myToday()
  const weightKg = useMemo(() => [...(weights || [])].sort((a, b) => a.date.localeCompare(b.date)).pop()?.kg || null, [weights])
  // The workout you just saved may not be in the live data yet: count it.
  const sessions = useMemo(() => {
    const m = new Map(liveDays)
    if (mode === 'workout' && workout?.date) m.set(workout.date, Math.max(m.get(workout.date) || 0, 1))
    return m
  }, [liveDays, mode, workout])

  const card = useMemo(() => {
    const first = (user.displayName || '').split(' ')[0]
    if (mode === 'month') {
      const ms = monthSummary(workouts, sessions, today, { weightKg })
      const ctx = ms.ctx
      const inMonth = workouts.filter((w) => w.date?.startsWith(today.slice(0, 7)))
      const lines = kindLines({ month: true })
      return {
        kind: 'month', ctx, heat: heatOf(inMonth, `${today.slice(0, 7)}-01`, today, 3),
        headline: style === 'week' ? 'This week' : `${ctx.monthDaysIn} day${ctx.monthDaysIn === 1 ? '' : 's'}`,
        subline: `in the gullak this ${ms.monthName}`,
        stats: [
          ms.minutes && { text: `${ms.minutes} min`, accent: 'lime' },
          ms.workouts && { text: `${ms.workouts} workout${ms.workouts === 1 ? '' : 's'}` },
          ctx.monthBoosts && { text: `+${ctx.monthBoosts} boost${ctx.monthBoosts === 1 ? '' : 's'}`, accent: 'orange' },
          ctx.streak > 1 && { text: `${ctx.streak} day streak` },
        ].filter(Boolean),
        muscles: [ms.topActivity && `Most: ${ms.topActivity}`, ms.topMuscle && `Most trained: ${ms.topMuscle}`].filter(Boolean),
        prs: [], lines, name: showName ? first : '',
        dateLabel: ms.monthName,
      }
    }
    const s = workoutSummary(workout, { weightKg })
    const ctx = daysContext(sessions, workout.date)
    const lines = kindLines({ prs, ctx, summary: s })
    const head = { gullak: `Day ${ctx.monthDaysIn}`, bloom: s.minutes ? `${s.minutes} min` : 'Today', week: ctx.streak > 1 ? `${ctx.streak} day streak` : 'This week' }[style]
    const sub = { gullak: `in the gullak this ${monthName(workout.date)}`, bloom: s.title || (s.muscles.length ? `${s.muscles.length} muscle group${s.muscles.length === 1 ? '' : 's'} today` : 'Moved today'), week: s.title || prettyDay(workout.date).split(',')[0] }[style]
    return {
      kind: 'workout', ctx, heat: heatOf([workout], workout.date, workout.date, 1),
      headline: head, subline: sub,
      stats: [
        s.minutes && style !== 'bloom' && { text: `${s.minutes} min`, accent: 'lime' },
        s.sets && { text: `${s.sets} set${s.sets === 1 ? '' : 's'}` },
        s.km && u && { text: `${u.toDist(s.km)} ${u.dist}` },
        s.kcal && { text: `about ${s.kcal} kcal` },
        ctx.todayN > 1 && { text: `+${ctx.todayN - 1} today`, accent: 'orange' },
        style !== 'week' && ctx.streak > 1 && { text: `${ctx.streak} day streak` },
      ].filter(Boolean),
      muscles: [...s.muscles.slice(0, 4).map((m) => m.label), ...s.activities.slice(0, 2)],
      prs: u ? prs.map((p) => prText(p, u)) : [],
      lines, name: showName ? first : '',
      dateLabel: prettyDay(workout.date).split(', ').slice(1).join(', ') || workout.date,
    }
  }, [mode, workout, workouts, sessions, weightKg, prs, style, showName, today, u, user.displayName])

  useEffect(() => {
    if (!canvasRef.current) return
    drawCard(canvasRef.current, { ...card, style, format, background, line: card.lines[lineIdx % card.lines.length] })
  }, [card, style, format, background, lineIdx, fontsReady])

  async function share() {
    setMsg('')
    const file = await cardFile(canvasRef.current, `fitpot-${mode === 'month' ? 'month' : workout.date}`)
    const text = card.lines[lineIdx % card.lines.length]
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: `${text} #FitPot` }); return } catch (e) { if (e.name === 'AbortError') return }
    }
    save(file)
    setMsg('Your phone can\'t share pictures from here, so it was saved instead. Share it from your gallery.')
  }
  async function save(f) {
    const file = f || await cardFile(canvasRef.current, `fitpot-${mode === 'month' ? 'month' : workout.date}`)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file); a.download = file.name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    if (!f) setMsg('Saved. Find it in your downloads or gallery.')
  }

  return (
    <div className="sheet share-sheet">
      <div className="sheet-head">
        <h3>{mode === 'month' ? 'Your month in FitPot' : 'Nice work. Share it?'}</h3>
        <button className="btn-ghost" onClick={onClose}>{mode === 'month' ? 'Close' : 'Not now'}</button>
      </div>
      <div className={`share-preview ${background === 'clear' ? 'clear' : ''}`}>
        <canvas ref={canvasRef} className={`share-canvas ${format}`} role="img" aria-label={`Share card: ${card.headline}, ${card.subline}. ${card.stats.map((s) => s.text).join(', ')}`} />
      </div>
      <div className="share-controls">
        <div className="chips" role="group" aria-label="Card style">
          {STYLES.map((s) => <button key={s.key} type="button" className={`chip ${style === s.key ? 'on' : ''}`} aria-pressed={style === s.key} onClick={() => setStyle(s.key)}>{s.label}</button>)}
        </div>
        <div className="chips" role="group" aria-label="Size and background">
          <button type="button" className={`chip ${format === 'post' ? 'on' : ''}`} aria-pressed={format === 'post'} onClick={() => setFormat('post')}>Post</button>
          <button type="button" className={`chip ${format === 'story' ? 'on' : ''}`} aria-pressed={format === 'story'} onClick={() => setFormat('story')}>Story</button>
          <button type="button" className={`chip ${background === 'dark' ? 'on' : ''}`} aria-pressed={background === 'dark'} onClick={() => setBackground('dark')}>Dark</button>
          <button type="button" className={`chip ${background === 'clear' ? 'on' : ''}`} aria-pressed={background === 'clear'} onClick={() => setBackground('clear')}>See-through</button>
        </div>
        <div className="share-row">
          <button type="button" className="btn-ghost" onClick={() => setLineIdx((i) => i + 1)}>Another line</button>
          <label className="check small"><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> Show my first name</label>
        </div>
      </div>
      <button className="btn-primary wide" onClick={share}>Share</button>
      <button className="btn-ghost wide" onClick={() => save()}>Save to my phone</button>
      {msg && <p className="muted small" role="status">{msg}</p>}
      <p className="muted small">See-through works as a sticker over your own photo in Stories. Nothing is posted anywhere unless you share it. Calories are an estimate.</p>
    </div>
  )
}

const monthName = (d) => new Date(`${d.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', timeZone: 'UTC' })

/** Body regions to glow levels 0 to 3. `per` = sets for one level step. */
function heatOf(list, from, to, per) {
  const by = setsByRegion(list, from, to)
  return Object.fromEntries(Object.entries(by).map(([k, n]) => [k, n >= 3 * per ? 3 : n >= 1.5 * per ? 2 : 1]))
}
