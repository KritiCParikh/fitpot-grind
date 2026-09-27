// Food search across four sources, all returned in one shape:
//
//   { key, source, name, brand, base: { kcal, protein, carbs, fat, fibre },
//     units: [{ label, factor }], barcode?, raw? }
//
// `base` is the nutrition for ONE base amount (100 g for database foods, one
// serving for your own foods). A unit's `factor` says how many base amounts
// one of that unit is: 1 g = 0.01 (of 100 g), 1 bowl of 292 g = 2.92.
//
// Sources: 🇮🇳 INDB (bundled file), 🇺🇸 USDA FoodData Central (free key),
// 📦 Open Food Facts (packaged/barcodes, no key), ⭐ your own foods.
// None of these are AI services; they're nutrition databases.

const USDA_KEY = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY' // DEMO_KEY works but is rate-limited
const round1 = (x) => Math.round((Number(x) || 0) * 10) / 10

export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']

export const NUTRIENTS = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fibre', label: 'Fibre', unit: 'g' },
]

export function scale(base, factor) {
  const out = {}
  for (const { key } of NUTRIENTS) out[key] = round1((base[key] || 0) * factor)
  return out
}

export function sumNutrients(list) {
  const out = Object.fromEntries(NUTRIENTS.map((n) => [n.key, 0]))
  for (const x of list) for (const { key } of NUTRIENTS) out[key] += x?.[key] || 0
  for (const k in out) out[k] = round1(out[k])
  return out
}

function gramUnits(extra = []) {
  return [...extra, { label: 'g', factor: 0.01, grams: 1 }, { label: '100 g', factor: 1, grams: 100 }]
}

// ---------- 🇮🇳 India: Indian Nutrient Databank (bundled, works offline) ----------
let indbPromise = null
function loadIndb() {
  indbPromise ||= fetch(`${import.meta.env.BASE_URL}data/indb.json`).then((r) => r.json()).then((d) =>
    d.foods.map(([code, name, kcal, protein, carbs, fat, fibre, unit, grams]) => ({
      key: `indb:${code}`,
      source: 'india',
      name,
      base: { kcal, protein, carbs, fat, fibre },
      units: gramUnits(unit && grams ? [{ label: `${unit} (${grams} g)`, factor: grams / 100, grams }] : []),
      search: name.toLowerCase(),
    })))
  return indbPromise
}

export async function searchIndia(q) {
  const foods = await loadIndb()
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return foods
    .filter((f) => words.every((w) => f.search.includes(w)))
    .sort((a, b) => a.search.indexOf(words[0]) - b.search.indexOf(words[0]) || a.name.length - b.name.length)
    .slice(0, 15)
}

// ---------- 🇺🇸 USA: USDA FoodData Central ----------
const USDA_IDS = { kcal: ['208', '957', '958'], protein: ['203'], carbs: ['205'], fat: ['204'], fibre: ['291'] }

function usdaNutrient(food, ids) {
  for (const id of ids) {
    const n = food.foodNutrients?.find((x) => String(x.nutrientNumber) === id)
    if (n && n.value != null) return n.value
  }
  return 0
}

export async function searchUSA(q, signal) {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
  url.searchParams.set('api_key', USDA_KEY)
  url.searchParams.set('query', q)
  url.searchParams.set('pageSize', '15')
  url.searchParams.set('dataType', 'Foundation,SR Legacy,Survey (FNDDS),Branded')
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(res.status === 429 ? 'USDA search limit reached, try again later' : 'USDA search failed')
  const data = await res.json()
  return (data.foods || []).map((f) => {
    const extra = []
    if (f.servingSize && /^g/i.test(f.servingSizeUnit || '')) {
      extra.push({ label: `${f.householdServingFullText || 'serving'} (${Math.round(f.servingSize)} g)`, factor: f.servingSize / 100, grams: f.servingSize })
    }
    for (const m of (f.foodMeasures || []).slice(0, 3)) {
      if (m.gramWeight) extra.push({ label: `${m.disseminationText} (${Math.round(m.gramWeight)} g)`, factor: m.gramWeight / 100, grams: m.gramWeight })
    }
    return {
      key: `usda:${f.fdcId}`,
      source: 'usa',
      name: titleCase(f.description),
      brand: f.brandOwner || f.brandName || '',
      base: Object.fromEntries(Object.entries(USDA_IDS).map(([k, ids]) => [k, round1(usdaNutrient(f, ids))])),
      units: gramUnits(extra),
    }
  })
}

// ---------- 📦 Packaged foods: Open Food Facts ----------
const OFF_FIELDS = 'code,product_name,brands,nutriments,serving_quantity,serving_size'

function fromOff(p) {
  const n = p.nutriments || {}
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : 0)
  const extra = p.serving_quantity ? [{ label: `serving${p.serving_size ? ` · ${p.serving_size}` : ''} (${Math.round(p.serving_quantity)} g)`, factor: p.serving_quantity / 100, grams: p.serving_quantity }] : []
  return {
    key: `off:${p.code}`,
    source: 'packaged',
    name: p.product_name || 'Unnamed product',
    brand: p.brands || '',
    barcode: p.code,
    base: {
      kcal: round1(kcal), protein: round1(n.proteins_100g), carbs: round1(n.carbohydrates_100g),
      fat: round1(n.fat_100g), fibre: round1(n.fiber_100g),
    },
    units: gramUnits(extra),
  }
}

export async function searchPackaged(q, signal) {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
  url.searchParams.set('search_terms', q)
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('action', 'process')
  url.searchParams.set('json', '1')
  url.searchParams.set('page_size', '15')
  url.searchParams.set('fields', OFF_FIELDS)
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('Packaged-food search failed')
  const data = await res.json()
  return (data.products || []).filter((p) => p.product_name && p.nutriments).map(fromOff)
}

export async function lookupBarcode(code) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.status === 1 && data.product ? fromOff({ ...data.product, code }) : null
}

// ---------- ⭐ Your own foods & recipes (stored privately in Firestore) ----------
export function fromMyFood(doc) {
  const units = [{ label: doc.servingLabel || 'serving', factor: 1, grams: doc.servingGrams || null }]
  if (doc.servingGrams) units.push({ label: 'g', factor: 1 / doc.servingGrams, grams: 1 })
  return {
    key: `mine:${doc.id}`,
    source: doc.kind === 'recipe' ? 'recipe' : 'mine',
    name: doc.name,
    brand: doc.kind === 'recipe' ? `recipe · ${doc.servings || 1} servings` : '',
    barcode: doc.barcode,
    base: doc.perServing,
    units,
    myId: doc.id,
    fav: true,
  }
}

export function searchMine(myFoods, q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  return myFoods.filter((f) => words.every((w) => f.name.toLowerCase().includes(w)))
}

function titleCase(s = '') {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export const SOURCE_LABEL = { india: '🇮🇳 India', usa: '🇺🇸 USA', packaged: '📦 Packaged', mine: '⭐ My food', recipe: '🍲 My recipe' }
