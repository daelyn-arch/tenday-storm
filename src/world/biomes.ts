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

export const BIOME_COLOR: Record<Biome, string> = {
  ocean: '#1a3550',
  coast: '#c9b271',
  plains: '#8aa45a',
  forest: '#3d6a3a',
  hills: '#7a8a4a',
  mountain: '#7d6f5a',
  desert: '#d6b87a',
  swamp: '#4a5b3a',
  tundra: '#cfd8dc',
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

// Pick biome from elevation (0..1) and moisture (0..1).
export function pickBiome(elevation: number, moisture: number, latitudeFactor: number): Biome {
  if (elevation < 0.32) return 'ocean'
  if (elevation < 0.38) return 'coast'
  if (latitudeFactor > 0.85) return 'tundra'
  if (elevation > 0.82) return 'mountain'
  if (elevation > 0.66) return 'hills'
  if (moisture < 0.28) return 'desert'
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
