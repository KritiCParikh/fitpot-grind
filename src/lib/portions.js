// Household portions, so nobody needs a kitchen scale (phase 5.11).
//
// Every food gets everyday measures (katori, cup, glass, tbsp, tsp, piece,
// handful) worked out from its name and type. They are typical weights, not
// exact: a katori of dal at home won't be exactly 150 g, but it's close
// enough to count calories well. Weights follow common references such as
// USDA's household measures (1 cup cooked rice about 158 g, 1 tbsp oil about
// 14 g, 1 large egg about 50 g).
//
// classify(name, hint) -> a portion class
// householdUnits(name, hint) -> [{ label, factor, grams }] (factor = per 100 g)

// One piece of a countable food, in grams. First match wins, so more
// specific words come first.
const PIECES = [
  [/\b(gulab jamun)\b/, 'piece', 45], [/\b(rasgulla|rasogolla)\b/, 'piece', 45], [/\bjalebi\b/, 'piece', 25],
  [/\b(laddu|ladoo|laddoo)\b/, 'piece', 40], [/\bbarfi\b|\bburfi\b/, 'piece', 25], [/\bmodak\b/, 'piece', 40],
  [/\b(phulka)\b/, 'phulka', 30], [/\b(roti|chapati|chapatti|fulka)\b/, 'roti', 40], [/\bthepla\b/, 'thepla', 40],
  [/\bparatha\b|\bparantha\b/, 'paratha', 80], [/\b(bhatura|bhature)\b/, 'bhatura', 60], [/\b(puri|poori)\b/, 'puri', 25],
  [/\bnaan\b/, 'naan', 90], [/\bkulcha\b/, 'kulcha', 80], [/\b(appam)\b/, 'appam', 50],
  [/\b(idli|idly)\b/, 'idli', 40], [/\b(uttapam|uthappam)\b/, 'uttapam', 120], [/\bdosa\b/, 'dosa', 90],
  [/\b(vada|wada)\b/, 'vada', 45], [/\bsamosa\b/, 'samosa', 60], [/\bkachori\b/, 'kachori', 50],
  [/\b(pakora|pakoda|bhaji|fritter)\b/, 'piece', 20], [/\bdhokla\b/, 'piece', 30], [/\b(momo|dumpling|gyoza|wonton)\b/, 'piece', 30],
  [/\b(spring roll|egg roll)\b/, 'roll', 65], [/\bsushi\b/, 'piece', 30],
  [/\b(egg|eggs|omelet|omelette)\b(?!.*(noodle|nog|roll|substitute|white|yolk|salad|sandwich|fried rice|curry|bhurji))/, 'egg', 50],
  [/\bbanana\b/, 'banana', 118], [/\bapple\b(?!.*(juice|sauce|pie|cider))/, 'apple', 180], [/\b(orange|mosambi|sweet lime)\b(?!.*juice)/, 'fruit', 130],
  [/\bmango\b(?!.*(juice|lassi|shake|pickle))/, 'mango', 200], [/\bguava\b/, 'guava', 100], [/\b(chikoo|chiku|sapota)\b/, 'chikoo', 100],
  [/\bpear\b/, 'pear', 180], [/\bpeach\b/, 'peach', 150], [/\bkiwi\b/, 'kiwi', 75], [/\b(date|dates|khajur)\b/, 'date', 8],
  [/\b(bread|toast)\b(?!.*(crumb|pudding|stuffing))/, 'slice', 28], [/\b(bun|pav|roll|rolls)\b/, 'bun', 50], [/\bbagel\b/, 'bagel', 100],
  [/\bcroissant\b/, 'croissant', 57], [/\bmuffin\b/, 'muffin', 110], [/\bdonut|doughnut\b/, 'doughnut', 60],
  [/\b(cookie|biscuit|rusk|cracker)\b/, 'piece', 12], [/\btortilla\b(?!.*chips)/, 'tortilla', 45], [/\btaco\b/, 'taco', 90],
  [/\bburrito\b/, 'burrito', 220], [/\b(burger|hamburger|cheeseburger)\b/, 'burger', 220], [/\bpizza\b/, 'slice', 107],
  [/\b(sandwich|sub)\b/, 'sandwich', 200], [/\b(sausage|frankfurter|hot dog)\b/, 'piece', 45],
  [/\b(drumstick)\b/, 'drumstick', 75], [/\b(chicken breast)\b/, 'breast', 120], [/\b(fillet|filet)\b/, 'fillet', 120],
  [/\b(kebab|kabab|tikka)\b/, 'piece', 30], [/\bpaneer\b(?!.*(curry|masala|makhani|butter|palak|matar|tikka|bhurji))/, 'cube', 25],
]

// Measures for each kind of food: [label, grams].
const KINDS = {
  drink:   [['glass', 250], ['cup', 240], ['tbsp', 15]],
  soup:    [['bowl', 250], ['katori', 150], ['cup', 240]],
  curry:   [['katori', 150], ['cup', 225], ['tbsp', 15]],
  grain:   [['katori', 120], ['cup', 160], ['tbsp', 10]],
  yogurt:  [['katori', 150], ['cup', 245], ['tbsp', 15]],
  fat:     [['tbsp', 14], ['tsp', 4.5]],
  sugar:   [['tsp', 4], ['tbsp', 12.5], ['cup', 200]],
  spice:   [['tsp', 2.5], ['tbsp', 7]],
  flour:   [['cup', 125], ['tbsp', 8], ['katori', 80]],
  dry:     [['cup', 190], ['katori', 120], ['tbsp', 12]],
  oats:    [['cup', 80], ['tbsp', 5]],
  cereal:  [['bowl', 40], ['cup', 30]],
  nuts:    [['handful', 28], ['tbsp', 9], ['cup', 140]],
  veg:     [['cup', 150], ['katori', 100]],
  leafy:   [['cup', 30], ['handful', 20]],
  fruit:   [['cup', 150], ['katori', 120]],
  meat:    [['palm-sized portion', 85], ['katori', 120], ['cup', 140]],
  cheese:  [['slice', 20], ['tbsp grated', 7], ['cup grated', 110]],
  snack:   [['handful', 28], ['cup', 30], ['small packet', 50]],
  sweet:   [['piece', 30], ['katori', 100], ['tbsp', 20]],
  general: [['katori', 150], ['cup', 200], ['tbsp', 15]],
}

// Hints from the bundled USDA list (its food category) and plain words in
// a name. Checked in order; the first match decides the kind.
const EARLY = 8
const RULES = [
  ['spice', /^(spices?\b|salt\b|table salt|baking (soda|powder)|leavening|pepper, black)|\b(turmeric|haldi|jeera|garam masala|masala powder|chilli powder|chili powder|coriander powder|hing|asafoetida|cardamom|ajwain|mustard seeds?|fenugreek seeds?)\b/],
  ['fat', /^(oil\b|oils\b|ghee|butter\b|margarine|lard|shortening|mayonnaise|mayo\b|vanaspati)|\bghee\b|\b(peanut|almond|cashew|sunflower seed|nut) butter\b|\b(cooking|vegetable|mustard|coconut|olive|sunflower|groundnut|sesame) oil\b/],
  ['sugar', /^(sugars?\b|jaggery|gur\b|honey\b|syrups?\b|molasses|jams?\b|jelly|jellies|sweetener|maple syrup)/],
  ['yogurt', /\b(yogurt|yoghurt|curd|dahi|raita|shrikhand|cottage cheese|ricotta|hung curd|kefir)\b(?!.*(covered|coated|raisins?|pretzels?|bar\b))/],
  ['oats', /^oats?\b(?!.*(cooked|cookie|bar\b))|\boatmeal, dry\b|\brolled oats\b/],
  ['flour', /\b(flour|atta|maida|besan|sooji|suji|rava|semolina|cornstarch|corn starch|cocoa powder|protein powder|whey protein)\b/],
  ['dry', /\b(rice|lentils?|dal|dhal|beans|chickpeas|chana|moong|mung|toor|masoor|urad|rajma|millet|quinoa|barley|pasta|noodles|macaroni|spaghetti|poha)\b.*\b(raw|uncooked|dry)\b|\b(raw|uncooked)\b.*\b(rice|lentils?|dal|beans|chickpeas|millet|quinoa|pasta)\b/],
  ['leafy', /\b(lettuce|spinach, raw|methi leaves|coriander leaves|cilantro|mint leaves|kale, raw|arugula)\b/],
  ['drink', /\b(milk|juice|tea|chai|coffee|lassi|chaas|buttermilk|smoothie|shake|soda|cola|drink|beverage|water|beer|wine|liquor|cocktail|kombucha|nectar|horlicks|bournvita)\b(?!.*(powder|chocolate|bread|rice|candy|cake|cookies?))/],
  ['soup', /\b(soup|broth|rasam|shorba|stew|pho|ramen|chowder|bisque)\b/],
  ['cereal', /\b(cereal|cornflakes|corn flakes|muesli|granola|flakes|puffs|chex|cheerios)\b/],
  ['nuts', /\b(nut|nuts|almond|almonds|cashew|cashews|walnut|walnuts|peanut|peanuts|pistachio|pistachios|seeds?|makhana|fox nut|trail mix|raisin|raisins|kishmish)\b(?!.*(butter|oil|milk|bar|cookie))/],
  ['cheese', /\bcheese\b(?!.*(cake|burger|sandwich|pizza|macaroni|sauce|dip|spread|nacho|quesadilla))/],
  ['snack', /\b(chips|crisps|namkeen|bhujia|mixture|chivda|popcorn|pretzels?|nachos|puffs)\b/],
  ['sweet', /\b(halwa|kheer|payasam|pudding|custard|ice cream|kulfi|dessert|cake|pastry|pie|brownie|sweet|mithai|chocolate|candy)\b/],
  ['grain', /\b(rice|biryani|pulao|pilaf|khichdi|khichri|poha|upma|pasta|noodles|noodle|spaghetti|macaroni|lo mein|chow mein|couscous|quinoa|millet|porridge|daliya|dalia|oatmeal|grits|congee|fried rice|risotto|bulgur)\b/],
  ['curry', /\b(dal|dhal|daal|curry|sabzi|sabji|subzi|masala|korma|makhani|gravy|sambar|sambhar|chole|chana|rajma|kadhi|kofta|keema|bhurji|paneer|palak|saag|aloo|gobi|bhindi|baingan|bharta|stew|chili|chilli|beans|lentils?|chickpeas|hummus|dip|sauce|stir.?fry|casserole|mixed dish|mixed dishes|bean, pea|legume)\b/],
  ['meat', /\b(chicken|mutton|lamb|goat|beef|pork|fish|prawn|prawns|shrimp|crab|turkey|duck|salmon|tuna|meat|steak|tofu|tempeh|soya chunks|seitan)\b/],
  ['fruit', /\b(fruit|berries|berry|strawberr|blueberr|grape|grapes|melon|watermelon|papaya|pineapple|pomegranate|cherries|lychee|litchi|plum|apricot)\b/],
  ['veg', /\b(vegetable|vegetables|salad|carrot|cucumber|tomato|onion|potato|cabbage|cauliflower|broccoli|peas|corn|okra|beans, green|capsicum|bell pepper|pepper, sweet|mushroom|pumpkin|squash|zucchini|beet|radish|eggplant|brinjal|gourd|lauki|tinda|karela)\b/],
]

// Food categories from the bundled USDA list that settle the kind on their own.
const CATEGORY = [
  ['drink', /(coffee|tea|juice|drinks?|milk|smoothies|soft drinks|water|beer|wine|liquor|formula|shakes)/],
  ['soup', /soups|ramen and asian broth/],
  ['fat', /(vegetable oils|butter and animal fats|margarine|mayonnaise|fats and oils)/],
  ['spice', /spices and herbs/],
  ['sugar', /(sugars and honey|jams, syrups|sweets)/],
  ['nuts', /(nuts and seeds|nut and seed)/],
  ['cereal', /ready-to-eat cereal|breakfast cereals/],
  ['snack', /(chips|pretzels|snack mix|popcorn|crackers|snacks)/],
  ['sweet', /(cakes|cookies|pastries|doughnuts|candy|ice cream|pudding|gelatins|baked products)/],
  ['yogurt', /(yogurt|cottage|ricotta)/],
  ['cheese', /^cheese$|dairy and egg products/],
  ['grain', /(rice|pasta|noodles|cooked grains|cooked cereals|oatmeal|cereal grains and pasta|fried rice)/],
  ['curry', /(mixed dishes|bean, pea, legume dishes|beans, peas, legumes|legumes and legume|vegetable dishes|dips|gravies|sauces|stir-fry)/],
  ['meat', /(poultry|chicken|beef|pork|lamb|fish|shellfish|seafood|sausages|meat|finfish|organ)/],
  ['fruit', /(fruits|berries|citrus|apples|bananas|grapes|melons|mango|peaches|pears|pineapple|strawberries|fruit)/],
  ['veg', /(vegetables|potatoes|carrots|broccoli|cabbage|corn|onions|tomatoes|spinach|string beans|lettuce)/],
]

/** The kind of food, from its name and an optional category hint. */
export function classify(name, hint = '') {
  const n = String(name || '').toLowerCase()
  const h = String(hint || '').toLowerCase()
  // The first few rules (spices, fats, sugars, yogurt, oats, flour, dry
  // grains, leafy greens) are clearest from the name, so they go first.
  for (const [kind, re] of RULES.slice(0, EARLY)) if (re.test(n)) return kind
  if (h) for (const [kind, re] of CATEGORY) if (re.test(h)) return kind
  for (const [kind, re] of RULES.slice(EARLY)) if (re.test(n)) return kind
  return 'general'
}

const NO_PIECES = new Set(['drink', 'soup', 'yogurt', 'cereal', 'sugar', 'fat', 'spice', 'flour', 'dry', 'oats', 'leafy'])
const PIECE_ONLY = new Set(['general', 'curry', 'grain', 'sweet', 'snack'])
const fmt = (g) => (g >= 10 ? Math.round(g) : Math.round(g * 10) / 10)
const unit = (label, grams) => ({ label: `${label} (about ${fmt(grams)} g)`, factor: grams / 100, grams, household: true })

/**
 * Everyday measures for a food, best first. `kind` skips classification when
 * the kind is already known (the bundled list stores it).
 */
export function householdUnits(name, hint = '', kind = '') {
  const n = String(name || '').toLowerCase()
  const out = []
  const k = kind || classify(name, hint)
  // Pieces only for things you count (not mango yogurt or a fruit juice).
  const piece = !NO_PIECES.has(k) && PIECES.find(([re]) => re.test(n))
  if (piece) out.push(unit(piece[1], piece[2]))
  if (piece && PIECE_ONLY.has(k)) return out // a roti, a dosa, an idli: pieces say it best
  for (const [label, grams] of KINDS[k] || KINDS.general) out.push(unit(label, grams))
  return out
}

/** Kinds as one-letter codes, for the bundled list (keeps the file small). */
export const KIND_CODES = Object.fromEntries(Object.keys(KINDS).map((k, i) => [k, String.fromCharCode(97 + i)]))
export const CODE_KINDS = Object.fromEntries(Object.entries(KIND_CODES).map(([k, c]) => [c, k]))
