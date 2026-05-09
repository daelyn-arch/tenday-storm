// Beautiful-map generator. Pure functions of (seed, width, height); same
// inputs → same output. Output is a tilemap that the renderer paints.

import { createNoise2D } from 'simplex-noise'
import { makeRng, randInt, type Rng } from '../world/rng'
import { autotileFor, type Terrain } from './autotile'

export type CellTerrain = 'water' | 'beach' | 'grass' | 'cliff'

export interface GeneratedMap {
  width: number
  height: number
  /** Per-tile terrain class (used for autotile + decor decisions). */
  terrain: Uint8Array
  /** Per-tile rendered tile filename (e.g. "t421"). */
  tileNames: (string | null)[]
  /** Forest cell? If true, a forest cluster sprite is drawn on top. */
  forest: Uint8Array
  /** Forest tile variant filename (only meaningful when forest[i] === 1). */
  forestTiles: (string | null)[]
  /** Decorative overlay sprites (rocks, houses). */
  decor: Decor[]
  /** Multi-tile structures. */
  structures: Structure[]
}

export interface Decor {
  x: number
  y: number
  size: number
  sprite: string
}

export interface Structure {
  x: number
  y: number
  w: number
  h: number
  sprite: string
}

const TERRAIN_CODE: Record<CellTerrain, Terrain> = {
  grass: 1,
  cliff: 4,
  water: 5,
  beach: 6,
}

/** ---------- noise fields ---------- */

function makeNoise(seed: number): (x: number, y: number) => number {
  const rng = makeRng(seed)
  return createNoise2D(rng)
}

/** Multi-octave noise → field in [0, 1]. */
function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves = 4) {
  let amp = 1
  let freq = 1
  let total = 0
  let max = 0
  for (let i = 0; i < octaves; i++) {
    total += amp * noise(x * freq, y * freq)
    max += amp
    amp *= 0.5
    freq *= 2
  }
  return (total / max + 1) / 2
}

/** Distance from edge falloff so the map naturally has ocean borders. */
function edgeFalloff(x: number, y: number, w: number, h: number): number {
  const cx = w / 2
  const cy = h / 2
  const dx = Math.abs(x - cx) / cx
  const dy = Math.abs(y - cy) / cy
  const d = Math.max(dx, dy)
  // 0 in centre, 1 at the edge; cube it for a sharper landfall.
  return Math.pow(Math.min(1, d), 3)
}

/** ---------- biome classification ---------- */

function classify(elev: number, _moist: number): CellTerrain {
  if (elev < 0.32) return 'water'
  if (elev < 0.40) return 'beach'
  if (elev > 0.78) return 'cliff'
  // grass or "wet grass"; we just call it grass for autotile purposes —
  // forest decoration is layered on top later.
  return 'grass'
}

/** ---------- autotile pass ---------- */

function pickCorner(
  terrain: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
): Terrain {
  // Corner is at the top-left of cell (cx, cy). Cells touching the corner:
  // (cx-1, cy-1), (cx, cy-1), (cx-1, cy), (cx, cy).
  // Priority order for which terrain "wins" the corner: water > cliff > beach > grass.
  let hasWater = false
  let hasCliff = false
  let hasBeach = false
  for (let dy = -1; dy <= 0; dy++) {
    for (let dx = -1; dx <= 0; dx++) {
      const x = cx + dx
      const y = cy + dy
      const t = x < 0 || x >= w || y < 0 || y >= h ? 5 : terrain[y * w + x] // OOB → water
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

/**
 * Compute "distance from land" for every water cell. Returns Uint8Array
 * (clamped at 255). Used to render shallow vs regular vs deep water tiles
 * so the ocean has visible depth gradient instead of a flat repeated tile.
 */
function computeWaterDepth(terrain: Uint8Array, w: number, h: number): Uint8Array {
  const depth = new Uint8Array(w * h).fill(255)
  // BFS from every land cell, distance grows outward.
  const queue: number[] = []
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] !== 5) {
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
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
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

function autotilePass(terrain: Uint8Array, w: number, h: number) {
  const tileNames: (string | null)[] = new Array(w * h).fill(null)
  const depth = computeWaterDepth(terrain, w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const tl = pickCorner(terrain, w, h, x, y)
      const tr = pickCorner(terrain, w, h, x + 1, y)
      const bl = pickCorner(terrain, w, h, x, y + 1)
      const br = pickCorner(terrain, w, h, x + 1, y + 1)
      // Pure water — pick a depth-appropriate tile so the ocean has a
      // visible shallow/regular/deep gradient instead of a flat repeating
      // grid of identical tiles. Pita's depth-water tiles:
      //   t821 = shallow ocean (terrain 7)
      //   t801 = regular ocean (terrain 8)
      //   t896 = deep ocean (terrain 9)
      if (tl === 5 && tr === 5 && bl === 5 && br === 5) {
        const d = depth[i]
        tileNames[i] = d <= 1 ? 't821' : d <= 3 ? 't801' : 't896'
        continue
      }
      const id = autotileFor(tl, tr, bl, br)
      if (id) {
        tileNames[i] = id
      } else {
        const t = terrain[i]
        tileNames[i] = t === 5 ? 't896' : t === 6 ? 't681' : t === 4 ? 't441' : 't1'
      }
    }
  }
  return { tileNames }
}

/** ---------- river carving ---------- */

function carveRivers(
  terrain: Uint8Array,
  elev: Float32Array,
  w: number,
  h: number,
  rng: Rng,
) {
  // Pick mountain sources, walk to ocean via steepest descent. Replace
  // intermediate cells with water (5).
  const candidates: number[] = []
  for (let i = 0; i < terrain.length; i++) {
    if (elev[i] > 0.7 && terrain[i] !== 5) candidates.push(i)
  }
  if (!candidates.length) return
  const sourceCount = Math.max(2, Math.min(8, Math.floor(candidates.length / 200)))
  const sources: number[] = []
  for (let i = 0; i < sourceCount && candidates.length > 0; i++) {
    const idx = Math.floor(rng() * candidates.length)
    sources.push(candidates[idx])
    candidates.splice(idx, 1)
  }
  for (const start of sources) {
    let cur = start
    const visited = new Set<number>([cur])
    for (let step = 0; step < 500; step++) {
      const cx = cur % w
      const cy = Math.floor(cur / w)
      let bestI = -1
      let bestE = elev[cur]
      // 8-neighbor steepest descent
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
          const ni = ny * w + nx
          if (visited.has(ni)) continue
          if (elev[ni] < bestE) {
            bestE = elev[ni]
            bestI = ni
          }
        }
      }
      if (bestI < 0) break
      visited.add(bestI)
      // Convert this cell to water (paints the river path)
      terrain[bestI] = 5
      if (terrain[bestI] === 5 && elev[bestI] < 0.32) break // reached ocean
      cur = bestI
    }
  }
}

/** ---------- forest mask + cluster overlay ----------
 * Forest is a SECOND layer over grass terrain. For each grass cell with
 * moisture above the threshold, we mark it as forest and pick a Pita tree-
 * cluster sprite. The renderer paints the cluster on top of the grass tile,
 * so dense forest reads as a continuous mass instead of scattered sprites.
 */

const FOREST_INTERIOR = ['t285', 't321', 't325'] // dense full-canopy variants
const FOREST_EDGE = ['t280', 't281', 't282', 't283', 't284', 't320', 't322', 't323', 't324', 't360', 't361', 't362', 't363', 't364']

function buildForestLayer(
  terrain: Uint8Array,
  moist: Float32Array,
  w: number,
  h: number,
  rng: Rng,
): { forest: Uint8Array; forestTiles: (string | null)[] } {
  const forest = new Uint8Array(w * h)
  // Pass 1 — mark which grass cells are forest based on moisture.
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] === 1 && moist[i] > 0.55) forest[i] = 1
  }
  // Pass 2 — for each forest cell, pick interior or edge variant. A cell
  // is "interior" iff all 4 cardinal neighbors are also forest; otherwise
  // it's an edge and uses one of the partial-cluster sprites for blending.
  const forestTiles: (string | null)[] = new Array(w * h).fill(null)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!forest[i]) continue
      const isInterior =
        (y > 0 && forest[i - w] === 1) &&
        (y < h - 1 && forest[i + w] === 1) &&
        (x > 0 && forest[i - 1] === 1) &&
        (x < w - 1 && forest[i + 1] === 1)
      const pool = isInterior ? FOREST_INTERIOR : FOREST_EDGE
      forestTiles[i] = pool[Math.floor(rng() * pool.length)]
    }
  }
  return { forest, forestTiles }
}

/** ---------- structure placement ---------- */

function placeStructures(
  terrain: Uint8Array,
  w: number,
  h: number,
  rng: Rng,
): Structure[] {
  // Find inland flat-grass spots away from water/cliff. Place small house
  // sprites first; we'll iterate to multi-tile castle sprites later.
  const out: Structure[] = []
  const tries = 60
  const placed: { x: number; y: number; r: number }[] = []
  for (let attempt = 0; attempt < tries && out.length < 10; attempt++) {
    const x = randInt(rng, 5, w - 6)
    const y = randInt(rng, 5, h - 6)
    // Require a 3x3 grass area
    let ok = true
    for (let dy = -1; dy <= 1 && ok; dy++) {
      for (let dx = -1; dx <= 1 && ok; dx++) {
        const t = terrain[(y + dy) * w + (x + dx)]
        if (t !== 1) ok = false
      }
    }
    if (!ok) continue
    // Min spacing
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 12)) continue
    placed.push({ x, y, r: 4 })
    const spriteVariants = ['house_0', 'house_1', 'house_2']
    out.push({
      x: x * 16,
      y: y * 16,
      w: 16,
      h: 16,
      sprite: spriteVariants[Math.floor(rng() * spriteVariants.length)],
    })
  }
  return out
}

/** ---------- top-level pipeline ---------- */

export function generateMap(seed: number, w: number, h: number): GeneratedMap {
  const rng = makeRng(seed)
  const elevNoise = makeNoise(seed)
  const moistNoise = makeNoise(seed ^ 0x9e3779b1)

  // Build elevation + moisture fields.
  const elev = new Float32Array(w * h)
  const moist = new Float32Array(w * h)
  const ef = 0.012
  const mf = 0.018
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const e0 = fbm(elevNoise, x * ef, y * ef, 4)
      const m0 = fbm(moistNoise, x * mf, y * mf, 3)
      const fall = edgeFalloff(x, y, w, h)
      elev[i] = Math.max(0, e0 - fall * 0.5) // edge bias toward ocean
      moist[i] = m0
    }
  }

  // Classify biomes
  const terrain = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const t = classify(elev[i], moist[i])
    terrain[i] = TERRAIN_CODE[t]
  }

  // Carve rivers (mutates terrain in place)
  carveRivers(terrain, elev, w, h, rng)

  // Autotile (water depth gradient handled inside)
  const { tileNames } = autotilePass(terrain, w, h)

  // Forest overlay layer
  const { forest, forestTiles } = buildForestLayer(terrain, moist, w, h, rng)

  // Structures (still placeholder houses for now)
  const structures = placeStructures(terrain, w, h, rng)

  return {
    width: w,
    height: h,
    terrain,
    tileNames,
    forest,
    forestTiles,
    decor: [],
    structures,
  }
}
