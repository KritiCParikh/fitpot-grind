import { useEffect, useMemo, useState } from 'react'

// After you log food, what you ate pops up as little hand-drawn sketches on a
// see-through layer for 5 seconds (phase 5.11). Drawn for FitPot, in its
// colours, line by line. Tap anywhere to close it early. No AI: each food is
// matched to a sketch by name, with a bowl for anything we haven't drawn.

const L = '#c6ff3d', O = '#ff7a1a', C = '#f2f5f3'

// Each sketch: [path, colour] lines in a 64 x 64 box, drawn a little wobbly.
const BOWL = [
  ['M9 31 Q12 52 32 54 Q52 52 55 31', C],
  ['M7 31 Q32 36 57 30', C],
  ['M24 54 Q32 58 40 54', C],
]
const CUP = [
  ['M14 25 L16 50 Q17 55 22 55 L38 55 Q43 55 44 50 L46 25 Z', C],
  ['M46 31 Q56 31 54 41 Q52 47 44 46', C],
]
const STEAM = [['M24 19 Q20 14 24 9 M32 19 Q28 13 32 7 M40 19 Q36 14 40 9', O]]
const SKETCHES = {
  bowl: [...BOWL, ['M18 27 Q24 22 30 27 Q36 22 42 27 Q46 24 50 27', L]],
  dal: [...BOWL, ['M11 30 Q17 25 23 30 Q29 25 35 30 Q41 25 47 30 Q51 27 54 29', O], ['M22 40 l0.5 0.5 M32 43 l0.5 0.5 M41 39 l0.5 0.5', L], ...STEAM],
  curry: [...BOWL, ['M11 30 Q20 26 32 30 Q44 26 54 29', O], ['M20 22 L26 20 L27 26 L21 27 Z M34 19 L40 21 L38 27 L33 25 Z', C], ...STEAM],
  rice: [...BOWL, ['M12 30 Q18 15 32 14 Q46 15 52 30', C], ['M22 22 l3 -1 M31 18 l3 1 M40 22 l-3 -1 M27 26 l2 1 M37 26 l2 -1', L]],
  roti: [['M32 11 Q50 12 53 31 Q52 51 32 53 Q13 52 11 32 Q12 13 32 11', C], ['M22 24 q2 -1 3 1 M38 22 q2 0 2 2 M27 38 q2 -1 3 1 M42 36 q1 2 -1 3 M33 30 l1 1', O]],
  egg: [['M32 9 Q46 11 48 35 Q47 54 32 55 Q17 54 16 35 Q18 11 32 9', C], ['M32 30 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0', L]],
  drumstick: [['M21 42 Q9 30 21 17 Q33 7 44 19 Q53 31 39 40 Q33 44 29 46', O], ['M29 46 L40 54', C], ['M37 57 Q40 51 45 55 Q48 59 43 59', C]],
  fish: [['M8 32 Q25 15 44 32 Q25 49 8 32 Z', C], ['M44 32 L57 21 L54 32 L57 43 Z', L], ['M19 29 l0.5 0.5', O], ['M28 25 Q33 32 28 39', O]],
  paneer: [['M12 27 L29 22 L41 28 L24 33 Z', C], ['M12 27 L12 43 L24 49 L24 33 M24 49 L41 44 L41 28', C], ['M44 41 L53 38 L58 42 L49 45 Z M44 41 L44 50 L49 53 L49 45 M49 53 L58 50 L58 42', L]],
  chai: [...CUP, ['M15 32 Q31 35 45 32', O], ...STEAM],
  coffee: [...CUP, ['M15 32 Q31 35 45 32', O], ['M25 42 Q30 38 35 42 Q30 46 25 42', C], ...STEAM],
  glass: [['M18 11 L22 55 L42 55 L46 11', C], ['M19 22 Q32 27 45 22', L], ['M37 5 L31 33', O]],
  shake: [['M20 16 L22 56 L42 56 L44 16 Z', C], ['M18 10 L46 10 L44 16 L20 16 Z', L], ['M26 30 L38 30', O]],
  banana: [['M13 17 Q13 44 36 51 Q52 53 55 44 Q40 44 30 36 Q20 28 20 15 Z', L], ['M13 17 L16 10', O]],
  apple: [['M32 18 Q20 10 14 22 Q8 40 20 52 Q26 56 32 52 Q38 56 44 52 Q56 40 50 22 Q44 10 32 18 Z', O], ['M32 18 Q33 10 36 6', C], ['M34 12 Q42 6 46 12 Q40 16 34 12', L]],
  mango: [['M20 18 Q38 8 50 24 Q58 44 40 52 Q22 58 16 42 Q12 28 20 18 Z', O], ['M24 16 Q22 8 30 6', C], ['M28 9 Q36 4 40 10 Q33 13 28 9', L]],
  fruit: [['M32 12 Q51 13 52 33 Q51 52 32 53 Q13 52 12 33 Q13 13 32 12', O], ['M32 33 L32 16 M32 33 L46 25 M32 33 L46 42 M32 33 L18 42 M32 33 L18 25', C]],
  salad: [['M12 50 Q14 17 51 11 Q51 46 12 50 Z', L], ['M12 50 Q30 32 51 11 M24 36 L22 28 M34 27 L34 19 M30 40 L38 40', C]],
  carrot: [['M23 18 L44 22 L17 55 Z', O], ['M30 20 Q26 10 30 4 M34 21 Q36 11 42 7 M38 22 Q44 15 50 14', L], ['M27 31 l5 1 M24 39 l4 1', C]],
  bread: [['M14 28 Q11 13 24 13 Q32 9 40 13 Q53 13 50 28 L48 53 L16 53 Z', O], ['M19 30 Q17 19 26 19 Q32 16 38 19 Q47 19 45 30 L44 48 L20 48 Z', C]],
  sandwich: [['M8 44 L32 14 L56 44 Z', O], ['M12 41 Q32 46 52 41', L], ['M15 37 Q32 41 49 37', C]],
  pizza: [['M10 14 Q32 6 54 14 L32 56 Z', O], ['M12 18 Q32 11 52 18', C], ['M27 25 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M37 30 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M31 40 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0', L]],
  burger: [['M10 30 Q12 12 32 12 Q52 12 54 30 Z', O], ['M9 34 Q32 38 55 34', L], ['M10 39 L54 39 L54 44 L10 44 Z', C], ['M11 48 Q32 50 53 48 Q52 55 32 55 Q12 55 11 48', O], ['M24 18 l2 0 M34 16 l2 0 M42 20 l2 0', C]],
  noodles: [...BOWL, ['M16 30 Q18 22 22 30 Q26 22 30 30 Q34 22 38 30 Q42 22 46 30', L], ['M40 6 L30 30 M48 8 L36 30', O]],
  dosa: [['M6 42 L52 20 Q60 30 53 40 Z', O], ['M18 36 L22 30 M28 32 L32 26 M38 28 L41 24', C], ['M50 50 m-7 0 a7 4 0 1 0 14 0 a7 4 0 1 0 -14 0', L]],
  idli: [['M8 38 Q8 28 20 28 Q32 28 32 38 Q32 44 20 44 Q8 44 8 38 Z', C], ['M30 30 Q30 20 42 20 Q54 20 54 30 Q54 36 42 36 Q30 36 30 30 Z', C], ['M38 48 m-9 0 a9 4 0 1 0 18 0 a9 4 0 1 0 -18 0', L]],
  samosa: [['M32 11 L55 50 L9 50 Z', O], ['M32 11 L36 50', C], ['M18 44 l2 -2 M44 44 l-2 -2', C]],
  sweet: [['M32 13 Q49 14 50 32 Q49 50 32 51 Q15 50 14 32 Q15 14 32 13', O], ['M24 25 l1 1 M38 23 l1 1 M30 34 l1 1 M41 37 l1 1 M23 40 l1 1', L]],
  cookie: [['M32 12 Q51 13 52 32 Q51 51 32 52 Q13 51 12 32 Q13 13 32 12', O], ['M24 24 l2 2 M38 22 l2 2 M30 34 l2 2 M42 38 l2 2 M21 40 l2 2', C]],
  icecream: [['M20 30 L32 58 L44 30', O], ['M20 30 Q16 18 26 16 Q28 6 38 10 Q48 12 44 30 Z', L], ['M25 37 L39 37 M27 44 L37 44', C]],
  nuts: [['M20 14 Q32 18 30 34 Q26 46 18 40 Q10 30 20 14 Z', O], ['M42 22 Q54 26 52 42 Q48 54 40 48 Q32 38 42 22 Z', O], ['M20 20 Q24 28 20 36 M43 28 Q47 36 43 44', C]],
  yogurt: [['M14 22 L18 54 L46 54 L50 22 Z', C], ['M12 22 L52 22', C], ['M16 30 Q32 34 48 30', L], ['M40 10 L30 34', O]],
}

// Food name -> sketch. First match wins.
const MATCH = [
  [/\b(dal|dhal|daal|sambar|sambhar|rasam|kadhi|soup|lentil)/, 'dal'],
  [/\b(dosa|uttapam|crepe)/, 'dosa'], [/\b(idli|idly)/, 'idli'], [/\b(samosa|kachori)/, 'samosa'],
  [/\b(roti|chapati|chapatti|phulka|paratha|naan|kulcha|thepla|puri|poori|bhatura|tortilla)/, 'roti'],
  [/\b(biryani|pulao|rice|khichdi|poha|upma|risotto)/, 'rice'],
  [/\b(noodle|pasta|spaghetti|ramen|chow mein|lo mein|maggi|pad thai)/, 'noodles'],
  [/\b(paneer|tofu|cheese)/, 'paneer'],
  [/\b(curry|masala|korma|makhani|chole|rajma|sabzi|sabji|keema|gravy|stew)/, 'curry'],
  [/\b(egg|omelet|omelette|anda)/, 'egg'],
  [/\b(chicken|mutton|lamb|turkey|kebab|kabab|tikka|tandoori|meat|beef|pork)/, 'drumstick'],
  [/\b(fish|salmon|tuna|prawn|shrimp|seafood)/, 'fish'],
  [/\b(chai|tea)\b/, 'chai'], [/\b(coffee|latte|cappuccino|espresso)/, 'coffee'],
  [/\b(shake|whey|protein powder|smoothie)/, 'shake'],
  [/\b(milk|juice|lassi|chaas|buttermilk|soda|drink|water|nimbu)/, 'glass'],
  [/\b(yogurt|yoghurt|curd|dahi|raita|shrikhand)/, 'yogurt'],
  [/\bbanana/, 'banana'], [/\bapple\b/, 'apple'], [/\bmango/, 'mango'],
  [/\b(orange|fruit|papaya|melon|berries|berry|grapes?|pineapple|guava|kiwi|pomegranate)/, 'fruit'],
  [/\b(salad|spinach|lettuce|greens|broccoli|cucumber|veg)/, 'salad'], [/\bcarrot/, 'carrot'],
  [/\b(pizza)/, 'pizza'], [/\b(burger)/, 'burger'], [/\b(sandwich|sub|wrap)/, 'sandwich'],
  [/\b(bread|toast|bun|pav|bagel|croissant)/, 'bread'],
  [/\b(ice cream|kulfi|gelato)/, 'icecream'],
  [/\b(cookie|biscuit|rusk|cracker)/, 'cookie'],
  [/\b(laddu|ladoo|barfi|burfi|jamun|rasgulla|halwa|kheer|jalebi|sweet|mithai|chocolate|cake|dessert)/, 'sweet'],
  [/\b(almond|cashew|walnut|peanut|nuts?|pistachio|makhana|seeds)/, 'nuts'],
  [/\b(oats|oatmeal|porridge|cereal|muesli|granola|dalia|daliya)/, 'bowl'],
]
export const sketchFor = (name) => {
  const n = String(name || '').toLowerCase()
  return (MATCH.find(([re]) => re.test(n)) || [null, 'bowl'])[1]
}

const LINES = [
  'Solid fuel. Your body says thanks.',
  'Logged and loved. That\'s FitPot.',
  'Fuel in, good things out.',
  'Nicely logged. Every entry counts.',
  'Good eating, good training.',
  'A plate worth showing up for.',
]

const short = (name) => {
  const first = String(name || '').split(',')[0].replace(/\s*\(.*?\)\s*/g, ' ').trim()
  return first.length > 22 ? `${first.slice(0, 21).trim()}...` : first
}
const listText = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || '')

/**
 * foods: names of foods to sketch, newest first (up to 3 different sketches
 * are drawn). onDone: called when it closes, by itself after 5 seconds or on a tap.
 */
export default function FoodDoodle({ foods, onDone }) {
  const [leaving, setLeaving] = useState(false)
  const picks = useMemo(() => {
    const out = [], used = new Set()
    for (const name of foods) {
      const s = sketchFor(name)
      if (used.has(s)) continue
      used.add(s); out.push({ name: short(name), sketch: s })
      if (out.length === 3) break
    }
    return out
  }, [foods])
  const line = useMemo(() => LINES[Math.floor(Math.random() * LINES.length)], [])

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), 4600)
    const end = setTimeout(onDone, 5000)
    return () => { clearTimeout(fade); clearTimeout(end) }
  }, [onDone])

  if (!picks.length) return null
  const spots = picks.length === 1 ? [[50, 44]] : picks.length === 2 ? [[34, 46], [66, 42]] : [[50, 30], [30, 58], [70, 58]]
  return (
    <div className={`doodle-layer ${leaving ? 'leaving' : ''}`} role="status" aria-live="polite" onClick={onDone}>
      <div className="doodle-stage">
        <svg className="doodle-plate" viewBox="0 0 200 200" aria-hidden="true">
          <path pathLength="1" d="M100 14 Q160 16 184 70 Q198 126 160 168 Q118 196 64 180 Q14 160 14 100 Q16 40 72 20 Q86 15 100 14" />
          <path pathLength="1" className="inner" d="M100 34 Q146 36 164 80 Q174 124 144 152 Q112 174 72 162 Q36 146 34 100 Q36 54 80 38 Q90 35 100 34" />
        </svg>
        {picks.map((p, i) => (
          <svg key={p.sketch} className={`doodle ${picks.length === 1 ? 'solo' : ''}`} viewBox="0 0 64 64" aria-hidden="true"
            style={{ left: `${spots[i][0]}%`, top: `${spots[i][1]}%`, '--d': `${300 + i * 350}ms` }}>
            {SKETCHES[p.sketch].map(([d, color], j) => <path key={j} d={d} stroke={color} pathLength="1" />)}
          </svg>
        ))}
      </div>
      <p className="doodle-names">{listText(picks.map((p) => p.name))}</p>
      <p className="doodle-line">{line}</p>
    </div>
  )
}
