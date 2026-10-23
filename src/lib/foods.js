// Food search across five sources, all returned in one shape:
//
//   { key, source, name, brand, base: { kcal, protein, carbs, fat, fibre },
//     units: [{ label, factor }], raw? }
//
// `base` is the nutrition for ONE base amount (100 g for database foods, one
// serving for your own foods). A unit's `factor` says how many base amounts
// one of that unit is: 1 g = 0.01 (of 100 g), 1 bowl of 292 g = 2.92.
//
// Sources: INDB for Indian dishes (bundled file), World: about 7,000 USDA dishes
// from many cuisines and plain ingredients (bundled file, phase 5.11), US
// brands from USDA FoodData Central (free key), Open Food Facts (packaged
// foods, no key), and your own foods.
// None of these are AI services; they're nutrition databases.
//
// Every database food also gets everyday measures (katori, cup, tbsp, piece)
// from portions.js, so nobody needs a kitchen scale.

import { householdUnits, CODE_KINDS } from './portions.js'

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

/** The database's own measures first, then everyday ones, then grams. */
function unitsFor(name, extra = [], hint = '', kind = '') {
  const house = householdUnits(name, hint, kind)
  // Skip an everyday measure if the database already has one by that name.
  const has = (label) => extra.some((u) => u.label.toLowerCase().startsWith(label.split(' (')[0].toLowerCase()))
  return gramUnits([...extra, ...house.filter((u) => !has(u.label))])
}

// Everyday words to the words the databases use, so "curd" finds yogurt.
const SYNONYMS = {
  curd: 'yogurt', dahi: 'yogurt', atta: 'whole wheat flour', maida: 'all-purpose flour', besan: 'chickpea flour',
  sooji: 'semolina', suji: 'semolina', rava: 'semolina', chawal: 'rice', chana: 'chickpeas', chole: 'chickpeas',
  rajma: 'kidney beans', moong: 'mung beans', toor: 'pigeon peas', arhar: 'pigeon peas', masoor: 'lentils',
  aloo: 'potato', gobi: 'cauliflower', bhindi: 'okra', palak: 'spinach', methi: 'fenugreek', baingan: 'eggplant',
  brinjal: 'eggplant', capsicum: 'bell pepper', jeera: 'cumin', haldi: 'turmeric', doodh: 'milk', anda: 'egg',
  murgh: 'chicken', chai: 'tea', makhana: 'lotus seeds', kaju: 'cashews', badam: 'almonds', mungfali: 'peanuts',
  groundnut: 'peanuts', ghee: 'ghee', paneer: 'paneer', lassi: 'yogurt drink', khichdi: 'rice and lentils',
}
const words = (q) => q.toLowerCase().split(/[\s,]+/).filter(Boolean)

// ---------- World: bundled USDA dishes and ingredients (offline) ----------
let worldPromise = null
function loadWorld() {
  worldPromise ||= fetch(`${import.meta.env.BASE_URL}data/world.json`).then((r) => r.json()).then((d) =>
    d.foods.map(([name, code, kcal, protein, carbs, fat, fibre], i) => ({
      key: `world:${i}:${name.slice(0, 24)}`,
      source: 'world',
      name,
      base: { kcal, protein, carbs, fat, fibre },
      kind: CODE_KINDS[code],
      search: name.toLowerCase(),
    })))
  return worldPromise
}

/** Ranks name matches: whole word at the start first, then shorter names. */
function rank(list, ws, max) {
  const first = ws[0]
  const score = (f) => (f.search.startsWith(first) ? 0 : f.search.includes(` ${first}`) ? 1 : 2)
  return list
    .filter((f) => ws.every((w) => f.search.includes(w)))
    .map((f) => [score(f), f])
    .sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length)
    .slice(0, max)
    .map(([, f]) => f)
}

export async function searchWorld(q) {
  const foods = await loadWorld()
  const ws = words(q)
  if (!ws.length) return []
  let hits = rank(foods, ws, 20)
  // Everyday words go first in their database form (curd -> yogurt, atta ->
  // whole wheat flour), then whatever matched the word as typed.
  if (ws.some((w) => SYNONYMS[w] && SYNONYMS[w] !== w)) {
    const alt = rank(foods, words(ws.map((w) => SYNONYMS[w] || w).join(' ')), 20)
    hits = [...alt, ...hits.filter((f) => !alt.includes(f))].slice(0, 20)
  }
  // Units are worked out only for the foods shown.
  return hits.map((f) => ({ ...f, units: unitsFor(f.name, [], '', f.kind) }))
}

// ---------- India: Indian Nutrient Databank (bundled, works offline) ----------
let indbPromise = null
function loadIndb() {
  indbPromise ||= fetch(`${import.meta.env.BASE_URL}data/indb.json`).then((r) => r.json()).then((d) =>
    d.foods.map(([code, name, kcal, protein, carbs, fat, fibre, unit, grams]) => ({
      key: `indb:${code}`,
      source: 'india',
      name,
      base: { kcal, protein, carbs, fat, fibre },
      units: unitsFor(name, unit && grams ? [{ label: `${unit} (${grams} g)`, factor: grams / 100, grams }] : []),
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

// ---------- USA: USDA FoodData Central ----------
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
  url.searchParams.set('dataType', 'Branded') // everyday dishes and ingredients are bundled in World
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(res.status === 429 ? 'USDA search limit reached, try again later' : 'USDA search failed')
  const data = await res.json()
  return (data.foods || []).map((f) => {
    const extra = []
    if (f.servingSize && /^g/i.test(f.servingSizeUnit || '')) {
      extra.push({ label: `${f.householdServingFullText || 'serving'} (${Math.round(f.servingSize)} g)`, factor: f.servingSize / 100, grams: f.servingSize })
    }
    for (const m of f.foodMeasures || []) {
      if (m.gramWeight) extra.push({ label: `${m.disseminationText} (${Math.round(m.gramWeight)} g)`, factor: m.gramWeight / 100, grams: m.gramWeight })
    }
    return {
      key: `usda:${f.fdcId}`,
      source: 'usa',
      name: titleCase(f.description),
      brand: f.brandOwner || f.brandName || '',
      base: Object.fromEntries(Object.entries(USDA_IDS).map(([k, ids]) => [k, round1(usdaNutrient(f, ids))])),
      units: extra.length ? gramUnits(extra) : unitsFor(f.description, [], f.foodCategory || ''),
    }
  })
}

// ---------- Packaged foods: Open Food Facts ----------
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

// ---------- Your own foods & recipes (stored privately in Firestore) ----------
export function fromMyFood(doc) {
  const units = [{ label: doc.servingLabel || 'serving', factor: 1, grams: doc.servingGrams || null }]
  if (doc.servingGrams) units.push({ label: 'g', factor: 1 / doc.servingGrams, grams: 1 })
  return {
    key: `mine:${doc.id}`,
    source: doc.kind === 'recipe' ? 'recipe' : 'mine',
    name: doc.name,
    brand: doc.kind === 'recipe' ? `recipe · ${doc.servings || 1} servings` : '',
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

export const SOURCE_LABEL = { india: 'India', world: 'World', usa: 'US brands', packaged: 'Packaged', mine: 'My food', recipe: 'My recipe' }
