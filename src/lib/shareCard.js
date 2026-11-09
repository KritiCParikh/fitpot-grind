// Share card drawing (phase 5.14). Everything is drawn on a <canvas> on the
// phone, in FitPot's colours, so the picture can be shared to any app or
// saved to the gallery. No outside service sees your data.
//
// Styles:  'gullak'  the FitPot gullak (kettlebell piggy bank) filling with a
//                    coin per workout day this month; boosts are orange coins
//          'bloom'   front and back body, the muscles you trained glowing lime
//          'week'    this week's seven days as dots, today's session below
// Formats: 'post' 1080 x 1350, 'story' 1080 x 1920
// Background: 'dark' or 'clear' (transparent PNG, a sticker over your own photo)

import { FRONT, BACK } from '../components/BodyMap'

const C = { bg: '#0b0d0c', surface: '#151917', border: '#242a27', text: '#f2f5f3', muted: '#8b958f', lime: '#c6ff3d', orange: '#ff7a1a', dim: '#2a332e' }
export const STYLES = [
  { key: 'gullak', label: 'Gullak' },
  { key: 'bloom', label: 'Body' },
  { key: 'week', label: 'Week' },
]
export const SIZES = { post: [1080, 1350], story: [1080, 1920] }
export const SHARE_URL = 'kriticparikh.github.io/fitpot-grind'

/** Make sure the card fonts are ready before drawing (falls back quietly). */
export async function loadCardFonts() {
  try { await Promise.all([document.fonts.load('120px Anton'), document.fonts.load('700 40px Inter'), document.fonts.load('400 40px Inter')]) } catch { /* system fonts */ }
}

const anton = (px) => `${px}px Anton, Impact, 'Arial Black', sans-serif`
const inter = (px, w = 400) => `${w} ${px}px Inter, system-ui, Arial, sans-serif`

/**
 * Draw a card. card = {
 *   kind: 'workout' | 'month', style, format, background,
 *   headline, subline, stats: [{ text, accent }], muscles: [label], prs: [text],
 *   line, name, dateLabel, ctx: daysContext(), heat: { region: level 0-3 }
 * }
 */
export function drawCard(canvas, card) {
  const [W, H] = SIZES[card.format] || SIZES.post
  canvas.width = W; canvas.height = H
  const g = canvas.getContext('2d')
  const clear = card.background === 'clear'
  g.clearRect(0, 0, W, H)
  if (!clear) {
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H)
    const glow = g.createRadialGradient(W / 2, H * 0.32, 40, W / 2, H * 0.32, W * 0.9)
    glow.addColorStop(0, 'rgba(198, 255, 61, 0.10)'); glow.addColorStop(1, 'rgba(198, 255, 61, 0)')
    g.fillStyle = glow; g.fillRect(0, 0, W, H)
  }
  g.textBaseline = 'alphabetic'
  // Readable on any photo when the background is clear.
  const shadow = (on) => { g.shadowColor = on && clear ? 'rgba(0, 0, 0, 0.6)' : 'transparent'; g.shadowBlur = on && clear ? 14 : 0 }
  shadow(true)

  const story = card.format === 'story'
  let y = story ? 170 : 110
  // Header: mark + FitPot, date on the right
  drawMark(g, 80, y - 46, 58)
  g.fillStyle = C.lime; g.font = anton(54); g.textAlign = 'left'; g.fillText('FitPot', 152, y)
  g.fillStyle = clear ? C.text : C.muted; g.font = inter(32, 500); g.textAlign = 'right'; g.fillText(card.dateLabel || '', W - 80, y - 4)

  y += story ? 90 : 40
  // Measure the text block first, then give the art whatever room is left.
  const footerY = H - (story ? 120 : 64)
  const textH = drawText(g, card, W, 0, true, clear, story, shadow)
  const artH = Math.max(320, Math.min(story ? 820 : 560, footerY - 50 - textH - y - (story ? 60 : 20)))
  if (card.style === 'bloom') drawBloom(g, W, y, artH, card.heat || {})
  else if (card.style === 'week') drawWeek(g, W, y, artH, card.ctx, clear)
  else drawGullak(g, W, y, artH, card.ctx, card.kind === 'month')
  y += artH + (story ? 60 : 20)
  // Centre the text block in the space left above the footer.
  const room = footerY - 40 - y
  drawText(g, card, W, y + Math.max(0, (room - textH) / 2), false, clear, story, shadow)

  // Footer
  const fy = footerY
  g.fillStyle = clear ? C.text : C.muted; g.font = inter(28, 500); g.textAlign = 'center'
  g.fillText(`${card.name ? `${card.name} on ` : ''}FitPot  ·  ${SHARE_URL}`, W / 2, fy)
  shadow(false)
}

/** Headline, line under it, stat pills, muscles, new-best ribbon and the kind line. Returns its height. */
function drawText(g, card, W, y0, dry, clear, story, shadow) {
  let y = y0
  const paint = (fn) => { if (!dry) fn() }
  g.textAlign = 'center'
  const big = story ? 128 : 104
  paint(() => { g.fillStyle = C.lime; g.font = anton(big); g.fillText(card.headline || '', W / 2, y + big * 0.82) })
  y += big * 0.82 + (story ? 66 : 58)
  if (card.subline) { paint(() => { g.fillStyle = clear ? C.text : C.muted; g.font = inter(38, 500); g.fillText(card.subline, W / 2, y) }); y += 34 }
  y += 30
  if (dry) { g.font = inter(36, 700); y += pillRows(g, W, card.stats || []) * 86 } else y = drawPills(g, W, y, card.stats || [], clear)
  if (card.muscles?.length) {
    g.font = inter(36, 700); g.fillStyle = C.text
    y = dry ? y + 38 + lines(g, card.muscles.join('  ·  '), W - 200) * 48 : wrap(g, card.muscles.join('  ·  '), W / 2, y + 38, W - 200, 48) + 4
    if (dry) y += 4
  }
  if (card.prs?.length) {
    y += 12
    paint(() => {
      const t = `New best  ·  ${card.prs[0]}${card.prs.length > 1 ? `  (+${card.prs.length - 1} more)` : ''}`
      g.font = inter(32, 700)
      const w = Math.min(W - 160, g.measureText(t).width + 64)
      shadow(false)
      roundRect(g, (W - w) / 2, y, w, 64, 32); g.fillStyle = C.orange; g.fill()
      g.fillStyle = C.bg; g.fillText(fit(g, t, w - 48), W / 2, y + 43)
      shadow(true)
    })
    y += 76
  }
  if (card.line) {
    const fs = story ? 50 : 42, lh = story ? 64 : 54
    g.font = inter(fs, 400); g.fillStyle = C.text
    const t = `\u201C${card.line}\u201D`
    y = dry ? y + 50 + (lines(g, t, W - 220) - 1) * lh + lh * 0.4 : wrap(g, t, W / 2, y + 50, W - 220, lh)
  }
  return y - y0
}

function pillRows(g, W, stats) {
  const widths = stats.map((s) => g.measureText(s.text).width + 60)
  let rows = stats.length ? 1 : 0, rw = 0
  widths.forEach((w, i) => { if (i && rw + 18 + w > W - 120) { rows++; rw = w } else rw += (i ? 18 : 0) + w })
  return rows
}

function lines(g, text, maxW) {
  let n = 1, line = ''
  for (const w of text.split(' ')) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > maxW && line) { n++; line = w } else line = t }
  return n
}

// ---------- art ----------

/** The FitPot mark (small gullak) at x, y with size s. */
function drawMark(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s / 512, s / 512)
  g.strokeStyle = C.lime; g.lineWidth = 62; g.lineCap = 'round'
  g.beginPath(); g.moveTo(164, 266); g.bezierCurveTo(142, 156, 190, 76, 256, 76); g.bezierCurveTo(322, 76, 370, 156, 348, 266); g.stroke()
  g.fillStyle = C.orange; roundRect(g, 188, 442, 136, 36, 14); g.fill()
  g.beginPath(); g.arc(256, 326, 148, 0, Math.PI * 2); g.fill()
  g.fillStyle = C.bg; roundRect(g, 198, 204, 116, 30, 15); g.fill()
  g.restore()
}

/** The big gullak filling with coins: lime = a day you showed up, orange = a boost. */
function drawGullak(g, W, top, h, ctx = {}, month = false) {
  const days = Math.min(31, ctx.monthDaysIn || 0)
  const boosts = Math.min(20, ctx.monthBoosts || 0)
  const R = h * 0.40, cx = W / 2, cy = top + h * 0.56
  g.save()
  // handle
  g.strokeStyle = C.lime; g.lineWidth = R * 0.24; g.lineCap = 'round'
  g.beginPath(); g.moveTo(cx - R * 0.62, cy - R * 0.42); g.bezierCurveTo(cx - R * 0.78, cy - R * 1.25, cx - R * 0.3, cy - R * 1.5, cx, cy - R * 1.5)
  g.bezierCurveTo(cx + R * 0.3, cy - R * 1.5, cx + R * 0.78, cy - R * 1.25, cx + R * 0.62, cy - R * 0.42); g.stroke()
  // foot
  g.fillStyle = C.orange; roundRect(g, cx - R * 0.46, cy + R * 0.9, R * 0.92, R * 0.22, R * 0.08); g.fill()
  // belly
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = '#1b201d'; g.fill()
  // coins, filling up from the bottom
  g.save(); g.beginPath(); g.arc(cx, cy, R - 14, 0, Math.PI * 2); g.clip()
  const coins = [...Array(days).fill(C.lime), ...Array(boosts).fill(C.orange)]
  const r = R * 0.13, step = r * 2.12
  let i = 0
  for (let row = 0; i < coins.length && row < 40; row++) {
    const yy = cy + R - r - 18 - row * step * 0.9
    const half = Math.sqrt(Math.max(0, (R - 20) ** 2 - (yy - cy) ** 2))
    const n = Math.max(1, Math.floor((half * 2) / step))
    const x0 = cx - ((n - 1) * step) / 2 + (row % 2 ? step / 4 : -step / 4)
    for (let k = 0; k < n && i < coins.length; k++, i++) {
      const xx = x0 + k * step
      g.beginPath(); g.arc(xx, yy, r, 0, Math.PI * 2); g.fillStyle = coins[i]; g.fill()
      g.beginPath(); g.arc(xx, yy, r * 0.62, 0, Math.PI * 2); g.strokeStyle = 'rgba(11, 13, 12, 0.35)'; g.lineWidth = r * 0.14; g.stroke()
    }
  }
  g.restore()
  // rim and slot
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.strokeStyle = C.orange; g.lineWidth = R * 0.09; g.stroke()
  g.fillStyle = C.bg; roundRect(g, cx - R * 0.36, cy - R * 0.78, R * 0.72, R * 0.14, R * 0.07); g.fill()
  // today's coin dropping in (workout cards only)
  if (!month) {
    g.beginPath(); g.arc(cx, cy - R * 1.04, r * 1.15, 0, Math.PI * 2); g.fillStyle = C.lime; g.fill()
    g.beginPath(); g.arc(cx, cy - R * 1.04, r * 0.7, 0, Math.PI * 2); g.strokeStyle = 'rgba(11, 13, 12, 0.35)'; g.lineWidth = r * 0.16; g.stroke()
  }
  g.restore()
}

/** Front and back body, trained muscles glowing. */
function drawBloom(g, W, top, h, heat) {
  const LV = ['#2a332e', '#3e5220', '#7fa62a', '#c6ff3d']
  const s = h / 350
  const bw = 160 * s
  const gap = 60
  const x0 = (W - bw * 2 - gap) / 2
  for (const [k, shapes] of [[0, FRONT], [1, BACK]]) {
    g.save(); g.translate(x0 + k * (bw + gap), top + 4); g.scale(s, s)
    g.beginPath(); g.arc(80, 24, 16, 0, Math.PI * 2); g.fillStyle = '#1e2522'; g.fill()
    for (const [region, tag, a] of shapes) {
      const lvl = heat[region] || 0
      g.fillStyle = LV[lvl]
      if (lvl === 3) { g.shadowColor = 'rgba(198, 255, 61, 0.7)'; g.shadowBlur = 14 } else { g.shadowColor = 'transparent'; g.shadowBlur = 0 }
      g.beginPath()
      if (tag === 'ellipse') g.ellipse(a.cx, a.cy, a.rx, a.ry, 0, 0, Math.PI * 2)
      else if (tag === 'rect') roundRect(g, a.x, a.y, a.width, a.height, a.rx || 0)
      else { const p = a.points.split(' ').map((q) => q.split(',').map(Number)); g.moveTo(p[0][0], p[0][1]); for (const [px, py] of p.slice(1)) g.lineTo(px, py); g.closePath() }
      g.fill()
    }
    g.restore()
  }
}

/** This week's seven days. */
function drawWeek(g, W, top, h, ctx = {}, clear) {
  const week = ctx.week || []
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const r = 54, step = (W - 160) / 7
  const cy = top + h * 0.45
  g.textAlign = 'center'
  week.forEach((d, i) => {
    const cx = 80 + step * i + step / 2
    g.fillStyle = clear ? C.text : C.muted; g.font = inter(34, 700); g.fillText(labels[i], cx, cy - r - 30)
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2)
    if (d.n > 0) { g.fillStyle = C.lime; g.fill() } else { g.fillStyle = d.future ? 'rgba(42, 51, 46, 0.5)' : C.dim; g.fill() }
    if (d.today) { g.lineWidth = 8; g.strokeStyle = C.text; g.stroke() }
    if (d.n > 1) {
      g.beginPath(); g.arc(cx + r * 0.72, cy - r * 0.72, 26, 0, Math.PI * 2); g.fillStyle = C.orange; g.fill()
      g.fillStyle = C.bg; g.font = inter(26, 800); g.fillText(`+${d.n - 1}`, cx + r * 0.72, cy - r * 0.72 + 9)
    }
  })
  g.fillStyle = C.text; g.font = inter(44, 700)
  g.fillText(`${ctx.weekDays || 0} day${ctx.weekDays === 1 ? '' : 's'} this week`, W / 2, cy + r + 90)
}

// ---------- helpers ----------

function drawPills(g, W, y, stats, clear) {
  if (!stats.length) return y
  g.font = inter(36, 700)
  const pad = 30, gap = 18, hgt = 70
  const widths = stats.map((s) => g.measureText(s.text).width + pad * 2)
  const rows = []
  let row = [], rw = 0
  widths.forEach((w, i) => { if (row.length && rw + gap + w > W - 120) { rows.push(row); row = []; rw = 0 } row.push(i); rw += (row.length > 1 ? gap : 0) + w })
  if (row.length) rows.push(row)
  for (const r of rows) {
    const total = r.reduce((a, i) => a + widths[i], 0) + gap * (r.length - 1)
    let x = (W - total) / 2
    for (const i of r) {
      const s = stats[i]
      g.save(); g.shadowColor = 'transparent'
      roundRect(g, x, y, widths[i], hgt, hgt / 2)
      g.fillStyle = s.accent === 'orange' ? C.orange : clear ? 'rgba(11, 13, 12, 0.72)' : C.surface; g.fill()
      if (!s.accent) { g.lineWidth = 2; g.strokeStyle = C.border; g.stroke() }
      g.fillStyle = s.accent === 'orange' ? C.bg : s.accent === 'lime' ? C.lime : C.text
      g.textAlign = 'center'; g.fillText(s.text, x + widths[i] / 2, y + 48)
      g.restore()
      x += widths[i] + gap
    }
    y += hgt + 16
  }
  return y
}

function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(' ')
  let line = ''
  for (const w of words) {
    const t = line ? `${line} ${w}` : w
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh } else line = t
  }
  if (line) g.fillText(line, x, y)
  return y + lh * 0.4
}

function fit(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 4 && g.measureText(`${t}...`).width > maxW) t = t.slice(0, -1)
  return `${t}...`
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}

/** The card as a PNG file, for sharing or saving. */
export function cardFile(canvas, name = 'fitpot') {
  return new Promise((res) => canvas.toBlob((b) => res(new File([b], `${name}.png`, { type: 'image/png' })), 'image/png'))
}
