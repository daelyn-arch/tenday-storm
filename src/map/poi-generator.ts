// POI-first map generator. Mirrors how a human map-maker composes a map:
// pick the interesting locations first (a fortress on a hilltop, a village
// by a river crossing, a watchtower on a cliff), THEN paint terrain that
// gives each its natural environment, THEN fill the gaps between with
// neutral wilderness.

import { createNoise2D } from 'simplex-noise'
import { makeRng, pick, randInt, type Rng } from '../world/rng'
import {
  AUTOTILE,
  FOREST_EDGE_GIDS,
  FOREST_INTERIOR_GIDS,
  OCEAN_DEEP_GID,
  OCEAN_REGULAR_GID,
  OCEAN_SHALLOW_GID,
} from './autotile'
import { loadStamps, type Stamp } from './stamps'

export interface PoiPlacement {
  name: string
  /** Top-left tile of the stamp footprint. */
  x: number
  y: number
  width: number
  height: number
}

export interface PoiGenMap {
  width: number
  height: number
  layers: { name: string; tiles: number[] }[]
  pois: PoiPlacement[]
}

const TERRAIN_GRASS = 1
const TERRAIN_CLIFF = 4
const TERRAIN_WATER = 5
const TERRAIN_BEACH = 6

interface PoiSpec {
  /** Stamp name in stamps.ts (Scenes.tmx region label). */
  stamp: string
  /** Footprint dimensions for spacing math. */
  size: { w: number; h: number }
  /** What kind of terrain should surround this POI. */
  prefers: 'inland-grass' | 'coast' | 'hilltop' | 'forest-fringe'
  /** Min spacing (in tiles) from other POIs. */
  minSpacing: number
}

const POI_TYPES: Record<string, PoiSpec> = {
  fortress: { stamp: 'fortress', size: { w: 16, h: 13 }, prefers: 'coast', minSpacing: 20 },
  watchtower: { stamp: 'watchtower', size: { w: 4, h: 6 }, prefers: 'hilltop', minSpacing: 10 },
  cabin: { stamp: 'cabin', size: { w: 5, h: 4 }, prefers: 'inland-grass', minSpacing: 8 },
  walled_city: { stamp: 'walled_city', size: { w: 19, h: 18 }, prefers: 'inland-grass', minSpacing: 30 },
}

interface ChosenPoi {
  type: keyof typeof POI_TYPES
  x: number
  y: number
}

/** Step 1 — pick POIs. */
function placePois(w: number, h: number, rng: Rng): ChosenPoi[] {
  // Each generation gets one walled city + 1-2 fortresses + a few watchtowers
  // + a couple cabins. Numbers tuned to fit a 50×40 map.
  const plan: { type: keyof typeof POI_TYPES; count: number }[] = [
    { type: 'walled_city', count: randInt(rng, 0, 1) },
    { type: 'fortress', count: randInt(rng, 0, 1) },
    { type: 'watchtower', count: randInt(rng, 1, 3) },
    { type: 'cabin', count: randInt(rng, 1, 3) },
  ]
  const out: ChosenPoi[] = []
  for (const { type, count } of plan) {
    const spec = POI_TYPES[type]
    for (let i = 0; i < count; i++) {
      let placed = false
      for (let attempt = 0; attempt < 80 && !placed; attempt++) {
        const x = randInt(rng, 3, w - spec.size.w - 3)
        const y = randInt(rng, 3, h - spec.size.h - 3)
        // Check spacing
        const ok = out.every((o) => {
          const od = POI_TYPES[o.type]
          const oc = { x: o.x + od.size.w / 2, y: o.y + od.size.h / 2 }
          const nc = { x: x + spec.size.w / 2, y: y + spec.size.h / 2 }
          const minD = Math.max(spec.minSpacing, od.minSpacing)
          return Math.hypot(oc.x - nc.x, oc.y - nc.y) >= minD
        })
        if (!ok) continue
        out.push({ type, x, y })
        placed = true
      }
    }
  }
  return out
}

/** Step 2 — elevation field that respects POI preferences. */
function buildElevation(
  w: number,
  h: number,
  pois: ChosenPoi[],
  rng: Rng,
): Float32Array {
  const noise = createNoise2D(rng)
  const elev = new Float32Array(w * h)
  const freq = 0.06
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Base noise + 1 octave
      const n = (noise(x * freq, y * freq) + 0.5 * noise(x * freq * 2, y * freq * 2)) / 1.5
      let e = (n + 1) / 2
      // Push down toward ocean near the map edges
      const cx = w / 2, cy = h / 2
      const dx = Math.abs(x - cx) / cx
      const dy = Math.abs(y - cy) / cy
      const edgeDist = Math.max(dx, dy)
      e -= Math.pow(Math.min(1, edgeDist), 2) * 0.55
      elev[y * w + x] = e
    }
  }
  // POI bias — sculpt the terrain to match each POI's preferred environment.
  for (const poi of pois) {
    const spec = POI_TYPES[poi.type]
    const cx = poi.x + spec.size.w / 2
    const cy = poi.y + spec.size.h / 2
    const r = Math.max(spec.size.w, spec.size.h) * 1.2
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d > r) continue
        const t = 1 - d / r
        const i = y * w + x
        switch (spec.prefers) {
          case 'inland-grass':
            // Force into the grass band (~0.4-0.6) inside the POI footprint
            elev[i] = elev[i] * (1 - t) + 0.5 * t
            break
          case 'coast':
            // Pull elevation toward beach (~0.42) so the POI sits on shoreline
            elev[i] = elev[i] * (1 - t) + 0.46 * t
            break
          case 'hilltop':
            // Push elevation up to hill/cliff range (~0.7+)
            elev[i] = elev[i] * (1 - t) + 0.78 * t
            break
          case 'forest-fringe':
            // Mid-grass, will get forest decoration later
            elev[i] = elev[i] * (1 - t) + 0.55 * t
            break
        }
      }
    }
  }
  return elev
}

/** Step 3 — classify each cell into a terrain code. */
function classify(elev: Float32Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h)
  for (let i = 0; i < elev.length; i++) {
    const e = elev[i]
    if (e < 0.32) out[i] = TERRAIN_WATER
    else if (e < 0.40) out[i] = TERRAIN_BEACH
    else if (e > 0.78) out[i] = TERRAIN_CLIFF
    else out[i] = TERRAIN_GRASS
  }
  return out
}

/** Pita's autotile needs corner-based terrain, not per-cell. */
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
      const t = x < 0 || x >= w || y < 0 || y >= h ? 5 : terrain[y * w + x]
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

/** Compute water-cell distance from land for shallow/deep gradient. */
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

/** Step 4 — turn terrain into final base-layer tile gids via autotile. */
function autotileToGids(terrain: Uint8Array, w: number, h: number): number[] {
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
      out[i] = gid ?? autotileFallback(terrain[i])
    }
  }
  return out
}

function autotileFallback(t: number): number {
  if (t === TERRAIN_WATER) return OCEAN_DEEP_GID
  if (t === TERRAIN_BEACH) return AUTOTILE['6,6,6,6']
  if (t === TERRAIN_CLIFF) return AUTOTILE['4,4,4,4']
  return AUTOTILE['1,1,1,1']
}

/** Step 5 — paint forest cluster overlay onto grass cells in moist regions. */
function forestOverlay(
  terrain: Uint8Array,
  w: number,
  h: number,
  rng: Rng,
): number[] {
  const noise = createNoise2D(rng)
  const mask = new Uint8Array(w * h)
  const freq = 0.09
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (terrain[i] !== TERRAIN_GRASS) continue
      const m = (noise(x * freq, y * freq) + 1) / 2
      if (m > 0.58) mask[i] = 1
    }
  }
  // Erode singletons — require connected clusters ≥ 3.
  smoothMask(mask, w, h, 3)
  const out = new Array<number>(w * h).fill(0)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!mask[i]) continue
      const interior =
        (y > 0 && mask[i - w] === 1) &&
        (y < h - 1 && mask[i + w] === 1) &&
        (x > 0 && mask[i - 1] === 1) &&
        (x < w - 1 && mask[i + 1] === 1)
      const pool = interior ? FOREST_INTERIOR_GIDS : FOREST_EDGE_GIDS
      out[i] = pool[Math.floor(rng() * pool.length)]
    }
  }
  return out
}

function smoothMask(mask: Uint8Array, w: number, h: number, minSize: number) {
  const visited = new Uint8Array(w * h)
  const queue: number[] = []
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || visited[i]) continue
    const cluster: number[] = []
    queue.length = 0
    queue.push(i)
    visited[i] = 1
    while (queue.length) {
      const c = queue.pop()!
      cluster.push(c)
      const cx = c % w
      const cy = Math.floor(c / w)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        const ni = ny * w + nx
        if (visited[ni] || !mask[ni]) continue
        visited[ni] = 1
        queue.push(ni)
      }
    }
    if (cluster.length < minSize) {
      for (const c of cluster) mask[c] = 0
    }
  }
}

/** Step 6 — clear the footprint of each POI so its stamp sits cleanly. */
function clearPoiFootprints(
  terrain: Uint8Array,
  pois: ChosenPoi[],
  w: number,
  h: number,
) {
  for (const poi of pois) {
    const spec = POI_TYPES[poi.type]
    for (let dy = -1; dy < spec.size.h + 1; dy++) {
      for (let dx = -1; dx < spec.size.w + 1; dx++) {
        const x = poi.x + dx
        const y = poi.y + dy
        if (x < 0 || x >= w || y < 0 || y >= h) continue
        // Don't touch water — the fortress/coast stamp likes water adjacency.
        if (terrain[y * w + x] === TERRAIN_WATER) continue
        terrain[y * w + x] = TERRAIN_GRASS
      }
    }
  }
}

/** Step 7 — stamp POI structures (paint non-empty stamp cells over terrain). */
function applyStamps(
  underTiles: number[],
  pois: ChosenPoi[],
  stamps: Map<string, Stamp>,
  w: number,
): number[] {
  // Stamps live on an "over" layer above the under terrain so we can leave
  // the procedural shore/transition tiles visible underneath.
  const over = new Array<number>(underTiles.length).fill(0)
  for (const poi of pois) {
    const spec = POI_TYPES[poi.type]
    const stamp = stamps.get(spec.stamp)
    if (!stamp) continue
    for (const cell of stamp.cells) {
      const x = poi.x + cell.dx
      const y = poi.y + cell.dy
      const i = y * w + x
      if (i < 0 || i >= over.length) continue
      over[i] = cell.gid
    }
  }
  return over
}

export async function generatePoiMap(
  seed: number,
  w: number,
  h: number,
  base: string,
): Promise<PoiGenMap> {
  const rng = makeRng(seed)
  const stamps = await loadStamps(base)

  // 1. Place POIs
  const pois = placePois(w, h, rng)
  // 2. Elevation with POI bias
  const elev = buildElevation(w, h, pois, rng)
  // 3. Classify terrain
  const terrain = classify(elev, w, h)
  // 4. Clear POI footprints so stamps don't sit on water/cliff
  clearPoiFootprints(terrain, pois, w, h)
  // 5. Reclassify smoothing — ensure ocean perimeter
  for (let i = 0; i < terrain.length; i++) {
    const x = i % w
    const y = Math.floor(i / w)
    if (x === 0 || x === w - 1 || y === 0 || y === h - 1) {
      terrain[i] = TERRAIN_WATER
    }
  }
  // 6. Autotile to base tile gids
  const under = autotileToGids(terrain, w, h)
  // 7. Forest overlay
  const forest = forestOverlay(terrain, w, h, rng)
  // 8. Stamp POIs as a separate "over" layer
  const over = applyStamps(under, pois, stamps, w)

  return {
    width: w,
    height: h,
    pois: pois.map((p) => ({
      name: p.type,
      x: p.x,
      y: p.y,
      width: POI_TYPES[p.type].size.w,
      height: POI_TYPES[p.type].size.h,
    })),
    layers: [
      { name: 'under', tiles: under },
      { name: 'forest', tiles: forest },
      { name: 'over', tiles: over },
    ],
  }
}

// re-export so callers can vary picker behaviour without importing rng.ts directly
export { pick }
