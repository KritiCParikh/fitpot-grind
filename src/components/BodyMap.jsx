// Front and back body outline with one shape per muscle region (phase 5.10).
// Our own drawing, in FitPot's colours. A region's key is a muscle part key
// (traps_mid) or, for groups with no parts, the group key (neck).
//
// Two ways to use it:
//   • picker: `bright` regions in full lime, `soft` ones dimmer (the rest of
//     the chosen group). Tapping a region calls onPick(region).
//   • heat map: `heat` gives each region a level 0 to 3.
// The dropdowns next to it are the keyboard-friendly way to choose; tapping
// the body is a shortcut.

const HEAT = ['#2a332e', '#3e5220', '#7fa62a', '#c6ff3d']
const BASE = '#2a332e', SOFT = '#55701f', LIME = '#c6ff3d'

// [region, shape, attributes]. Shapes come in left and right pairs.
const e = (region, cx, cy, rx, ry) => [region, 'ellipse', { cx, cy, rx, ry }]
const pair = (region, cx, cy, rx, ry) => [e(region, cx, cy, rx, ry), e(region, 160 - cx, cy, rx, ry)]
const r = (region, x, y, width, height, rx) => [region, 'rect', { x, y, width, height, rx }]
const poly = (region, points) => [region, 'polygon', { points }]

const FRONT = [
  r('neck', 72, 40, 16, 12, 3),
  poly('traps_upper', '72,46 52,60 70,58'), poly('traps_upper', '88,46 108,60 90,58'),
  ...pair('delt_side', 40, 76, 5, 11),
  ...pair('delt_front', 50, 72, 10, 11),
  r('chest_upper', 60, 58, 19, 14, 3), r('chest_upper', 81, 58, 19, 14, 3),
  r('chest_lower', 60, 73, 19, 20, 4), r('chest_lower', 81, 73, 19, 20, 4),
  ...pair('bi_long', 40, 104, 4.5, 15),
  ...pair('bi_short', 48, 104, 4.5, 15),
  ...pair('fa_ext', 37, 138, 4.5, 17),
  ...pair('fa_flex', 45, 138, 4.5, 17),
  ...pair('grip', 40, 165, 6, 6),
  r('abs_upper', 68, 96, 24, 22, 4),
  r('abs_lower', 68, 120, 24, 28, 4),
  poly('obliques', '60,96 66,96 66,146 58,138'), poly('obliques', '100,96 94,96 94,146 102,138'),
  poly('adductors', '72,152 79,152 79,178'), poly('adductors', '88,152 81,152 81,178'),
  ...pair('quad_out', 61, 196, 5.5, 28),
  ...pair('quad_in', 76, 212, 4, 15),
  ...pair('quad_rf', 69, 192, 5.5, 30),
  ...pair('shins', 66, 264, 5, 24),
  ...pair('feet', 66, 318, 10, 6),
]

const BACK = [
  r('neck', 72, 40, 16, 12, 3),
  poly('traps_upper', '80,42 56,60 80,66 104,60'),
  poly('traps_mid', '66,64 94,64 88,88 72,88'),
  poly('traps_lower', '72,90 88,90 80,110'),
  ...pair('delt_side', 40, 76, 5, 11),
  ...pair('delt_rear', 50, 72, 10, 11),
  poly('lats', '58,80 68,90 76,128 62,120 56,98'), poly('lats', '102,80 92,90 84,128 98,120 104,98'),
  r('lower_back', 70, 112, 9, 32, 3), r('lower_back', 81, 112, 9, 32, 3),
  ...pair('tri_lat', 40, 100, 4.5, 13),
  ...pair('tri_long', 48, 102, 4.5, 15),
  ...pair('tri_med', 44, 120, 5, 5),
  ...pair('fa_ext', 40, 138, 5, 17),
  ...pair('fa_flex', 48, 140, 4, 15),
  ...pair('grip', 40, 165, 6, 6),
  ...pair('glute_med', 63, 148, 7, 6),
  ...pair('glute_max', 71, 161, 10, 12),
  ...pair('ham_out', 63, 203, 5.5, 26),
  ...pair('ham_in', 72, 203, 5.5, 26),
  ...pair('gastroc', 66, 252, 7, 16),
  ...pair('soleus', 66, 279, 5, 10),
  ...pair('feet', 66, 318, 8, 6),
]
const IN_FRONT = new Set(FRONT.map((s) => s[0]))
const IN_BACK = new Set(BACK.map((s) => s[0]))

export default function BodyMap({ bright = [], soft = [], heat = null, onPick, size = 132 }) {
  const b = new Set(bright), s = new Set(soft)
  const fill = (region) => (heat ? HEAT[heat[region] || 0] : b.has(region) ? LIME : s.has(region) ? SOFT : BASE)
  const lit = [...b, ...s]
  const frontOn = !heat && lit.some((x) => IN_FRONT.has(x))
  const backOn = !heat && lit.some((x) => IN_BACK.has(x))

  const view = (shapes, label, on) => (
    <figure className="body-view">
      <svg viewBox="0 0 160 340" width={size} height={Math.round(size * 340 / 160)} role="img" aria-label={`${label} view of the body`}>
        <circle cx="80" cy="24" r="16" fill="#1e2522" />
        {shapes.map(([region, Tag, attrs], i) => (
          <Tag key={i} {...attrs} fill={fill(region)} className={onPick ? 'region tap' : 'region'}
            onClick={onPick ? () => onPick(region) : undefined} />
        ))}
      </svg>
      <figcaption className={on ? 'lime' : 'muted'}>{label.toUpperCase()}</figcaption>
    </figure>
  )

  return (
    <div className="body-map">
      {view(FRONT, 'Front', frontOn)}
      {view(BACK, 'Back', backOn)}
    </div>
  )
}

/** The colour scale used by the heat map, for its legend. */
export const HEAT_COLORS = HEAT
