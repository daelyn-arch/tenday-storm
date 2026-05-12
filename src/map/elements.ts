// Per-element generators. Each one paints a single terrain feature in
// isolation onto a small grid so the user can iterate on the rendering of
// that one feature without map-scale noise. Once each element looks good
// these become the building blocks for the full-map composer.

import { createNoise2D } from 'simplex-noise'
import { makeRng, type Rng } from '../world/rng'
import {
  AUTOTILE,
  FOREST_INTERIOR_GIDS,
  OCEAN_DEEP_GID,
  OCEAN_REGULAR_GID,
  OCEAN_SHALLOW_GID,
} from './autotile'
import { loadStamps } from './stamps'
import { loadForestLookup, pickForestGid } from './forest-autotile'

export interface ElementMap {
  width: number
  height: number
  layers: { name: string; tiles: number[] }[]
}

const TERRAIN_GRASS = 1
const TERRAIN_CLIFF = 4
const TERRAIN_WATER = 5
const TERRAIN_BEACH = 6

// ---------------- shared helpers ----------------

function pickCorner(
  terrain: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
): 1 | 4 | 5 | 6 {
  let hasWater = false
  let hasCliff = false
  let hasBeach = false
  for (let dy = -1; dy <= 0; dy++) {
    for (let dx = -1; dx <= 0; dx++) {
      const x = cx + dx
      const y = cy + dy
      const t = x < 0 || x >= w || y < 0 || y >= h ? terrain[Math.max(0, Math.min(w - 1, x)) + Math.max(0, Math.min(h - 1, y)) * w] : terrain[y * w + x]
      if (t === 5) hasWater = true
      else if (t === 4) hasCliff = true
      else if (t === 6) hasBeach = true
    }
  }
  if (hasWater) return 5
  if (hasCliff) return 4
  if (hasBeach) return 6
  return 1
}

function computeDepth(terrain: Uint8Array, w: number, h: number): Uint8Array {
  const depth = new Uint8Array(w * h).fill(255)
  const queue: number[] = []
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] !== TERRAIN_WATER) {
      depth[i] = 0
      queue.push(i)
    }
  }
  let head = 0
  while (head < queue.length) {
    const i = queue[head++]
    const cx = i % w
    const cy = Math.floor(i / w)
    const d = depth[i]
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
      const ni = ny * w + nx
      if (depth[ni] > d + 1) {
        depth[ni] = d + 1
        queue.push(ni)
      }
    }
  }
  return depth
}

function autotileBase(terrain: Uint8Array, w: number, h: number): number[] {
  const depth = computeDepth(terrain, w, h)
  const out = new Array<number>(w * h).fill(0)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const tl = pickCorner(terrain, w, h, x, y)
      const tr = pickCorner(terrain, w, h, x + 1, y)
      const bl = pickCorner(terrain, w, h, x, y + 1)
      const br = pickCorner(terrain, w, h, x + 1, y + 1)
      if (tl === 5 && tr === 5 && bl === 5 && br === 5) {
        const d = depth[i]
        out[i] = d <= 1 ? OCEAN_SHALLOW_GID : d <= 3 ? OCEAN_REGULAR_GID : OCEAN_DEEP_GID
        continue
      }
      const gid = AUTOTILE[`${tl},${tr},${bl},${br}`]
      out[i] = gid ?? AUTOTILE['1,1,1,1']
    }
  }
  return out
}

// ---------------- elements ----------------

export const ELEMENT_TYPES = [
  'plains',
  'forest',
  'hills',
  'mountain_range',
  'mountain_peak',
  'island_small',
  'island_medium',
  'lake',
  'beach',
  'castle',
  'fortress',
  'walled_city',
  'village',
  'watchtower',
  'cabin',
] as const

export type ElementType = (typeof ELEMENT_TYPES)[number]

const SIZE = 16 // every element is rendered on a 16×16 tile canvas

/** Plains — the simplest element: pure grass with subtle moisture variation. */
function genPlains(_rng: Rng): ElementMap {
  const terrain = new Uint8Array(SIZE * SIZE).fill(TERRAIN_GRASS)
  return {
    width: SIZE,
    height: SIZE,
    layers: [{ name: 'under', tiles: autotileBase(terrain, SIZE, SIZE) }],
  }
}

/**
 * Forest patch — grass base with a forest mass picked using the Pita-
 * learned autotile lookup (forest-autotile.ts scans Scenes.tmx +
 * GuideExamples.tmx to find which forest tile Pita uses for each 4-side
 * neighbor pattern, since the TSX doesn't formally tag these).
 */
async function genForest(rng: Rng, base: string): Promise<ElementMap> {
  const lookup = await loadForestLookup(base)
  const terrain = new Uint8Array(SIZE * SIZE).fill(TERRAIN_GRASS)
  const noise = createNoise2D(rng)
  const mask = new Uint8Array(SIZE * SIZE)
  const cx = SIZE / 2
  const cy = SIZE / 2
  // Larger blob — most cells need to be interior for the autotile to look
  // like a continuous forest mass instead of scattered shadowed sprites.
  const radius = SIZE * 0.5
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy) / radius
      const n = (noise(x * 0.22, y * 0.22) + 1) / 2
      if (n - d * 0.55 > 0.3) mask[y * SIZE + x] = 1
    }
  }
  const forest = new Array<number>(SIZE * SIZE).fill(0)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x
      if (!mask[i]) continue
      // Build the 4-side pattern this cell sits in.
      let pattern = 0
      if (y > 0 && mask[i - SIZE]) pattern |= 0b0001 // north
      if (x < SIZE - 1 && mask[i + 1]) pattern |= 0b0010 // east
      if (y < SIZE - 1 && mask[i + SIZE]) pattern |= 0b0100 // south
      if (x > 0 && mask[i - 1]) pattern |= 0b1000 // west
      const gid = pickForestGid(lookup, pattern, rng)
      if (gid != null) forest[i] = gid
    }
  }
  return {
    width: SIZE,
    height: SIZE,
    layers: [
      { name: 'under', tiles: autotileBase(terrain, SIZE, SIZE) },
      { name: 'forest', tiles: forest },
    ],
  }
}

/** Hills — grass with hill autotile cluster (using cliff-light tile pool). */
function genHills(rng: Rng): ElementMap {
  // Hills are tricky — Pita has a "Hills" terrain (id 3) but only one pure
  // tile (201). For a focused element we just lay down the hill tile in a
  // small cluster on grass and call it good. Future iteration: dedicated
  // hill autotile lookup.
  const terrain = new Uint8Array(SIZE * SIZE).fill(TERRAIN_GRASS)
  const under = autotileBase(terrain, SIZE, SIZE)
  const overlay = new Array<number>(SIZE * SIZE).fill(0)
  const HILL_GID = 162 // tile id 161 = hills, gid 162
  const cx = SIZE / 2
  const cy = SIZE / 2
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d < 4 + rng() * 2) overlay[y * SIZE + x] = HILL_GID
    }
  }
  return {
    width: SIZE,
    height: SIZE,
    layers: [
      { name: 'under', tiles: under },
      { name: 'hills', tiles: overlay },
    ],
  }
}

/** Mountain range — long ridge of cliff tiles with autotiled grass edges. */
function genMountainRange(rng: Rng): ElementMap {
  const terrain = new Uint8Array(SIZE * SIZE).fill(TERRAIN_GRASS)
  // Walk from one side to the other, painting cliff cells with thickness.
  const startY = Math.floor(SIZE * 0.35 + rng() * SIZE * 0.3)
  let y = startY
  for (let x = 1; x < SIZE - 1; x++) {
    for (let dy = -2; dy <= 2; dy++) {
      const ny = y + dy
      if (ny < 1 || ny >= SIZE - 1) continue
      // Thicker in middle, thinner at edges
      if (Math.abs(dy) <= 1 || rng() > 0.4) {
        terrain[ny * SIZE + x] = TERRAIN_CLIFF
      }
    }
    if (rng() < 0.35) y += rng() < 0.5 ? 1 : -1
    y = Math.max(2, Math.min(SIZE - 3, y))
  }
  return {
    width: SIZE,
    height: SIZE,
    layers: [{ name: 'under', tiles: autotileBase(terrain, SIZE, SIZE) }],
  }
}

/** Single mountain peak — a small cliff cluster. */
function genMountainPeak(rng: Rng): ElementMap {
  const terrain = new Uint8Array(SIZE * SIZE).fill(TERRAIN_GRASS)
  const cx = SIZE / 2
  const cy = SIZE / 2
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d < 3.5 + rng() * 0.8) terrain[y * SIZE + x] = TERRAIN_CLIFF
    }
  }
  return {
    width: SIZE,
    height: SIZE,
    layers: [{ name: 'under', tiles: autotileBase(terrain, SIZE, SIZE) }],
  }
}

/** Small island — a circular grass blob in ocean with beach edges. */
function genIslandSmall(rng: Rng): ElementMap {
  const terrain = new Uint8Array(SIZE * SIZE).fill(TERRAIN_WATER)
  const cx = SIZE / 2
  const cy = SIZE / 2
  const r = 4 + rng() * 1
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy) + (rng() - 0.5) * 1.2
      if (d < r) terrain[y * SIZE + x] = TERRAIN_GRASS
      else if (d < r + 1) terrain[y * SIZE + x] = TERRAIN_BEACH
    }
  }
  return {
    width: SIZE,
    height: SIZE,
    layers: [{ name: 'under', tiles: autotileBase(terrain, SIZE, SIZE) }],
  }
}

/** Medium island — bigger blob with beach ring + interior forest patch. */
function genIslandMedium(rng: Rng): ElementMap {
  const terrain = new Uint8Array(SIZE * SIZE).fill(TERRAIN_WATER)
  const cx = SIZE / 2
  const cy = SIZE / 2
  const r = 6 + rng() * 1
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy) + (rng() - 0.5) * 1.5
      if (d < r - 1) terrain[y * SIZE + x] = TERRAIN_GRASS
      else if (d < r) terrain[y * SIZE + x] = TERRAIN_BEACH
      else terrain[y * SIZE + x] = TERRAIN_WATER
    }
  }
  // Sprinkle a small forest patch
  const forest = new Array<number>(SIZE * SIZE).fill(0)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x
      if (terrain[i] !== TERRAIN_GRASS) continue
      const d = Math.hypot(x - cx, y - cy)
      if (d < r - 3 && rng() < 0.5) {
        forest[i] = FOREST_INTERIOR_GIDS[Math.floor(rng() * FOREST_INTERIOR_GIDS.length)]
      }
    }
  }
  return {
    width: SIZE,
    height: SIZE,
    layers: [
      { name: 'under', tiles: autotileBase(terrain, SIZE, SIZE) },
      { name: 'forest', tiles: forest },
    ],
  }
}

/** Inland lake — grass with circular water blob in the middle. */
function genLake(rng: Rng): ElementMap {
  const terrain = new Uint8Array(SIZE * SIZE).fill(TERRAIN_GRASS)
  const cx = SIZE / 2
  const cy = SIZE / 2
  const r = 4 + rng() * 1
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy) + (rng() - 0.5) * 1.0
      if (d < r) terrain[y * SIZE + x] = TERRAIN_WATER
    }
  }
  return {
    width: SIZE,
    height: SIZE,
    layers: [{ name: 'under', tiles: autotileBase(terrain, SIZE, SIZE) }],
  }
}

/** Beach — straight coastline running diagonally. */
function genBeach(_rng: Rng): ElementMap {
  const terrain = new Uint8Array(SIZE * SIZE)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x
      const onLand = x + y < SIZE - 2
      const onBeach = Math.abs(x + y - (SIZE - 2)) < 1.5
      terrain[i] = onLand ? TERRAIN_GRASS : onBeach ? TERRAIN_BEACH : TERRAIN_WATER
    }
  }
  return {
    width: SIZE,
    height: SIZE,
    layers: [{ name: 'under', tiles: autotileBase(terrain, SIZE, SIZE) }],
  }
}

/** Generic structure — render the named stamp on a grass background. */
async function genStructure(stampName: string, base: string): Promise<ElementMap> {
  const stamps = await loadStamps(base)
  const stamp = stamps.get(stampName)
  if (!stamp) {
    return genPlains(makeRng(0))
  }
  // Make canvas big enough for the stamp + 2-tile grass border
  const w = stamp.width + 4
  const h = stamp.height + 4
  const terrain = new Uint8Array(w * h).fill(TERRAIN_GRASS)
  const under = autotileBase(terrain, w, h)
  const over = new Array<number>(w * h).fill(0)
  const ox = 2
  const oy = 2
  for (const cell of stamp.cells) {
    const x = cell.dx + ox
    const y = cell.dy + oy
    const i = y * w + x
    if (i >= 0 && i < over.length) over[i] = cell.gid
  }
  return {
    width: w,
    height: h,
    layers: [
      { name: 'under', tiles: under },
      { name: 'over', tiles: over },
    ],
  }
}

/** Village — three cabins clustered with footpaths between them. */
async function genVillage(rng: Rng, base: string): Promise<ElementMap> {
  const stamps = await loadStamps(base)
  const cabin = stamps.get('cabin')
  const w = SIZE
  const h = SIZE
  const terrain = new Uint8Array(w * h).fill(TERRAIN_GRASS)
  const under = autotileBase(terrain, w, h)
  const over = new Array<number>(w * h).fill(0)
  if (cabin) {
    // Place 3 cabins in a triangle around the centre.
    const cx = w / 2
    const cy = h / 2
    const positions = [
      { x: cx - 4, y: cy - 2 },
      { x: cx + 1, y: cy - 3 },
      { x: cx - 1, y: cy + 2 },
    ]
    for (const pos of positions) {
      const px = Math.floor(pos.x + (rng() - 0.5) * 1.5)
      const py = Math.floor(pos.y + (rng() - 0.5) * 1.5)
      for (const cell of cabin.cells) {
        const x = cell.dx + px
        const y = cell.dy + py
        if (x < 0 || x >= w || y < 0 || y >= h) continue
        over[y * w + x] = cell.gid
      }
    }
  }
  return {
    width: w,
    height: h,
    layers: [
      { name: 'under', tiles: under },
      { name: 'over', tiles: over },
    ],
  }
}

export async function generateElement(
  type: ElementType,
  seed: number,
  base: string,
): Promise<ElementMap> {
  const rng = makeRng(seed)
  switch (type) {
    case 'plains':
      return genPlains(rng)
    case 'forest':
      return genForest(rng, base)
    case 'hills':
      return genHills(rng)
    case 'mountain_range':
      return genMountainRange(rng)
    case 'mountain_peak':
      return genMountainPeak(rng)
    case 'island_small':
      return genIslandSmall(rng)
    case 'island_medium':
      return genIslandMedium(rng)
    case 'lake':
      return genLake(rng)
    case 'beach':
      return genBeach(rng)
    case 'castle':
    case 'fortress':
      return genStructure('fortress', base)
    case 'walled_city':
      return genStructure('walled_city', base)
    case 'watchtower':
      return genStructure('watchtower', base)
    case 'cabin':
      return genStructure('cabin', base)
    case 'village':
      return genVillage(rng, base)
  }
}

