import type { Biome } from '../types/db'

export const BIOMES: Biome[] = [
  'ocean',
  'coast',
  'plains',
  'forest',
  'hills',
  'mountain',
  'desert',
  'swamp',
  'tundra',
]

// Painted-miniature palette — warm, characterful biome fills.
// Each color has a matching "shadow" tone used for the inner-rim ring that
// gives every tile some depth (see HexMap.tsx).
export const BIOME_COLOR: Record<Biome, string> = {
  ocean:    '#2e567a',
  coast:    '#e8d9a8',
  plains:   '#94b063',
  forest:   '#345230',
  hills:    '#a07f4f',
  mountain: '#766558',
  desert:   '#d9b673',
  swamp:    '#4d6638',
  tundra:   '#c8d0d4',
}

export const BIOME_SHADOW: Record<Biome, string> = {
  ocean:    '#16324f',
  coast:    '#b59a5a',
  plains:   '#5b7a36',
  forest:   '#152619',
  hills:    '#5e4423',
  mountain: '#3a2f26',
  desert:   '#9a7032',
  swamp:    '#28401d',
  tundra:   '#5a6f7a',
}

export const BIOME_LABEL: Record<Biome, string> = {
  ocean: 'Ocean',
  coast: 'Coast',
  plains: 'Plains',
  forest: 'Forest',
  hills: 'Hills',
  mountain: 'Mountain',
  desert: 'Desert',
  swamp: 'Swamp',
  tundra: 'Tundra',
}

export const BIOME_PASSABLE: Record<Biome, boolean> = {
  ocean: false,
  coast: true,
  plains: true,
  forest: true,
  hills: true,
  mountain: true,
  desert: true,
  swamp: true,
  tundra: true,
}

// Pick biome from elevation (0..1), moisture (0..1), and latitudeFactor (0..1
// where 0 = equator-ish middle of the map and 1 = polar edge).
//
// Biomes are gated by climate band so adjacent hexes never jump from cold to
// hot: tundra only spawns in the high-latitude band, desert only in the
// low-latitude band, with a temperate buffer between them. That guarantees
// at least a few rows of plains/forest separate any tundra from any desert.
export function pickBiome(elevation: number, moisture: number, latitudeFactor: number): Biome {
  if (elevation < 0.32) return 'ocean'
  if (elevation < 0.38) return 'coast'
  if (elevation > 0.82) return 'mountain'
  if (elevation > 0.66) return latitudeFactor > 0.65 ? 'mountain' : 'hills'

  if (latitudeFactor > 0.65) {
    // Cold band: boreal forest where wet, tundra elsewhere. No desert here.
    return moisture > 0.55 ? 'forest' : 'tundra'
  }
  if (latitudeFactor < 0.35) {
    // Warm band: desert when dry, swamp when very wet, otherwise forest/plains.
    if (moisture < 0.3) return 'desert'
    if (moisture > 0.78) return 'swamp'
    if (moisture > 0.55) return 'forest'
    return 'plains'
  }
  // Temperate buffer: no tundra, no desert.
  if (moisture > 0.78) return 'swamp'
  if (moisture > 0.55) return 'forest'
  return 'plains'
}

// Encounter pool by biome — DM picks/rerolls during play.
export const ENCOUNTERS: Record<Biome, string[]> = {
  ocean: ['stranded sailor on flotsam', 'sea-storm', 'pod of whales'],
  coast: ['driftwood beachcomber', 'shipwreck remains', 'tide pools with strange shells'],
  plains: ['merchant caravan', 'wolf pack', 'lost shepherd', 'ancient roadside shrine'],
  forest: [
    'goblin ambush',
    'fey ring',
    'wounded druid',
    'overgrown ruin',
    'territorial owlbear',
  ],
  hills: ['bandit lookout', 'kobold scout party', 'hermit cave', 'old battlefield'],
  mountain: [
    'rock slide',
    'griffon nest',
    'frost giant patrol',
    'sealed dwarven gate',
    'lone monastery',
  ],
  desert: ['dust devil', 'caravan in distress', 'sand worm tracks', 'forgotten oasis'],
  swamp: [
    'will-o-wisps',
    'lizardfolk hunting party',
    'witch hut',
    'sunken statue',
    'black-water spring',
  ],
  tundra: ['blizzard', 'wendigo tracks', 'frozen mammoth', 'ice troll bridge'],
}

// Hex feature list (decorative, shown as bullet points to players when revealed).
export const FEATURE_POOL: Record<Biome, string[]> = {
  ocean: ['rolling waves', 'distant ship'],
  coast: ['salt-bleached cliffs', 'fishing village'],
  plains: ['windswept grass', 'standing stones', 'farmstead'],
  forest: ['ancient oaks', 'mossy carved trail markers', 'low mist'],
  hills: ['rolling green', 'ruined watchtower', 'sheep pasture'],
  mountain: ['snow-capped peak', 'narrow pass', 'echoing crevasse'],
  desert: ['shifting dunes', 'sun-bleached bones', 'bleached cacti'],
  swamp: ['cypress shadows', 'foul mire', 'tangled vines'],
  tundra: ['frozen tarn', 'aurora overhead', 'wind-scoured ice'],
}
