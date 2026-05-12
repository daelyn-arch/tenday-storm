// Learn an autotile lookup for Pita's forest tiles by observing how Pita
// actually placed them in the example TMX maps. Pita's TSX doesn't formally
// tag forest tiles with terrain transitions (terrain 0 = "trees, object
// layer"), so the only way to know which tile fits at the west-edge of a
// forest mass vs the south-edge vs an interior cell is to read it off the
// hand-crafted examples.

import { parseTmx } from './tmx-parse'

/** Forest tile gids (1-indexed, matching Tiled). All tiles in this set are
 *  considered "forest" for the purposes of pattern-matching adjacencies. */
const FOREST_GIDS = new Set<number>(
  [
    280, 281, 282, 283, 284, 285,
    320, 321, 322, 323, 324, 325,
    360, 361, 362, 363, 364,
  ].map((id) => id + 1),
)

/**
 * Pattern is a 4-bit mask: bit 0 = north, 1 = east, 2 = south, 3 = west.
 * 1 means the neighbor in that direction is also a forest tile.
 * 0b1111 = "interior" (forest on every side); 0b0000 = "isolated".
 */
export interface ForestLookup {
  /** pattern (0..15) → array of (gid, frequency) entries. */
  byPattern: Map<number, { gid: number; freq: number }[]>
  /**
   * Pair compatibility: pairCompat[direction][tile_gid] = set of tile gids
   * that Pita places adjacent to this tile in that direction. Direction
   * 0=N, 1=E, 2=S, 3=W. The special gid 0 means "no forest tile here"
   * (i.e. grass / outside the forest mass) — used for edge cells.
   *
   * Encodes Pita's actual tile-to-tile transitions, so picking a tile
   * compatible with already-placed neighbors guarantees seamless edges.
   */
  pairCompat: Map<number, Map<number, Set<number>>>
}

let cached: ForestLookup | null = null
const EMPTY_GID = 0 // sentinel for "no forest tile" (grass)
export const DIR = { N: 0, E: 1, S: 2, W: 3 } as const
export const OPPOSITE = [DIR.S, DIR.W, DIR.N, DIR.E] as const

const SOURCES = ['Scenes.tmx', 'GuideExamples.tmx']

export async function loadForestLookup(base: string): Promise<ForestLookup> {
  if (cached) return cached
  const counts = new Map<number, Map<number, number>>() // pattern → (gid → count)
  // pairCompat[dir] : Map<tile_gid, Set<neighbor_gid>>
  const pairCompat = new Map<number, Map<number, Set<number>>>([
    [DIR.N, new Map()],
    [DIR.E, new Map()],
    [DIR.S, new Map()],
    [DIR.W, new Map()],
  ])
  for (const source of SOURCES) {
    const url = `${base}textures/_pita/${source}`
    let map: Awaited<ReturnType<typeof parseTmx>>
    try {
      map = await parseTmx(url)
    } catch (e) {
      console.warn('forest learner: skipped', source, e)
      continue
    }
    const w = map.width
    const h = map.height
    for (const layer of map.layers) {
      const tiles = layer.tiles
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const gid = tiles[y * w + x]
          if (!FOREST_GIDS.has(gid)) continue
          const n = y > 0 ? tiles[(y - 1) * w + x] : 0
          const e = x < w - 1 ? tiles[y * w + x + 1] : 0
          const s = y < h - 1 ? tiles[(y + 1) * w + x] : 0
          const we = x > 0 ? tiles[y * w + x - 1] : 0
          // Pattern lookup (legacy: still useful for fast first-pick).
          let pattern = 0
          if (FOREST_GIDS.has(n)) pattern |= 0b0001
          if (FOREST_GIDS.has(e)) pattern |= 0b0010
          if (FOREST_GIDS.has(s)) pattern |= 0b0100
          if (FOREST_GIDS.has(we)) pattern |= 0b1000
          let bucket = counts.get(pattern)
          if (!bucket) {
            bucket = new Map()
            counts.set(pattern, bucket)
          }
          bucket.set(gid, (bucket.get(gid) ?? 0) + 1)
          // Pair compatibility: record the actual neighbor (forest gid or 0).
          const neighbors: [number, number][] = [
            [DIR.N, FOREST_GIDS.has(n) ? n : EMPTY_GID],
            [DIR.E, FOREST_GIDS.has(e) ? e : EMPTY_GID],
            [DIR.S, FOREST_GIDS.has(s) ? s : EMPTY_GID],
            [DIR.W, FOREST_GIDS.has(we) ? we : EMPTY_GID],
          ]
          for (const [d, neighborGid] of neighbors) {
            const dirMap = pairCompat.get(d)!
            let set = dirMap.get(gid)
            if (!set) {
              set = new Set()
              dirMap.set(gid, set)
            }
            set.add(neighborGid)
          }
        }
      }
    }
  }
  const byPattern = new Map<number, { gid: number; freq: number }[]>()
  for (const [pattern, bucket] of counts) {
    const entries = Array.from(bucket.entries()).map(([gid, freq]) => ({ gid, freq }))
    entries.sort((a, b) => b.freq - a.freq)
    byPattern.set(pattern, entries)
  }
  cached = { byPattern, pairCompat }
  return cached
}

/**
 * Place forest tiles into a binary mask using center-out constrained
 * placement. For each cell, the chosen tile is restricted to ones Pita
 * has actually placed adjacent to all already-placed neighbors. This
 * guarantees every tile-pair on the boundary is one Pita uses, so edges
 * blend cleanly into surrounding grass.
 *
 * Returns an array of tile gids (0 = no tile placed).
 */
export function placeConstrainedForest(
  lookup: ForestLookup,
  mask: Uint8Array,
  width: number,
  height: number,
  rand: () => number,
): number[] {
  const out = new Array<number>(mask.length).fill(0)
  // Find the most-interior forest cell to start from (highest count of
  // 4-cardinal-forest neighbors gives us the most room to pick a true
  // interior tile and propagate from there).
  let centerIdx = -1
  let bestNeighbors = -1
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    const x = i % width
    const y = Math.floor(i / width)
    let count = 0
    if (y > 0 && mask[i - width]) count++
    if (x < width - 1 && mask[i + 1]) count++
    if (y < height - 1 && mask[i + width]) count++
    if (x > 0 && mask[i - 1]) count++
    if (count > bestNeighbors) {
      bestNeighbors = count
      centerIdx = i
    }
  }
  if (centerIdx < 0) return out

  // Pick an interior tile (pattern 0b1111) for the center if available.
  const centerCandidates = lookup.byPattern.get(0b1111) ?? lookup.byPattern.get(0b0000) ?? []
  if (centerCandidates.length === 0) return out
  out[centerIdx] = sampleByFreq(centerCandidates, rand)

  // BFS outward, picking each tile constrained by already-placed neighbors.
  const queue: number[] = [centerIdx]
  const seen = new Uint8Array(mask.length)
  seen[centerIdx] = 1
  while (queue.length) {
    const i = queue.shift()!
    const x = i % width
    const y = Math.floor(i / width)
    const dirs: [number, number, number][] = [
      [DIR.N, x, y - 1],
      [DIR.E, x + 1, y],
      [DIR.S, x, y + 1],
      [DIR.W, x - 1, y],
    ]
    for (const [, nx, ny] of dirs) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      const ni = ny * width + nx
      if (!mask[ni] || seen[ni]) continue
      seen[ni] = 1
      // Build the constraint set: for each placed-or-empty neighbor,
      // restrict to tiles Pita uses with that neighbor in that direction.
      let valid: Set<number> | null = null
      const niDirs: [number, number, number][] = [
        [DIR.N, nx, ny - 1],
        [DIR.E, nx + 1, ny],
        [DIR.S, nx, ny + 1],
        [DIR.W, nx - 1, ny],
      ]
      for (const [d, nnx, nny] of niDirs) {
        const oob = nnx < 0 || nnx >= width || nny < 0 || nny >= height
        const nni = oob ? -1 : nny * width + nnx
        let target: number | null = null
        if (oob || !mask[nni]) {
          // Outside the forest mask → grass. Need a tile Pita uses with
          // EMPTY in this direction.
          target = EMPTY_GID
        } else if (out[nni]) {
          // Forest neighbor with tile already placed → must match.
          target = out[nni]
        } else {
          // Forest neighbor not yet placed → no constraint from this side.
          continue
        }
        const allowedHere = new Set<number>()
        const dirCompat = lookup.pairCompat.get(d)
        if (dirCompat) {
          for (const [tile, neighbors] of dirCompat) {
            if (neighbors.has(target)) allowedHere.add(tile)
          }
        }
        valid = valid ? intersect(valid, allowedHere) : allowedHere
        if (valid.size === 0) break
      }
      let pick: number
      if (valid && valid.size > 0) {
        // Weight valid tiles by their overall frequency so common tiles win.
        const weighted: { gid: number; freq: number }[] = []
        for (const tile of valid) {
          let f = 0
          for (const ents of lookup.byPattern.values()) {
            for (const e of ents) if (e.gid === tile) f += e.freq
          }
          weighted.push({ gid: tile, freq: f || 1 })
        }
        pick = sampleByFreq(weighted, rand)
      } else {
        // Fall back to closest pattern match if constraints can't be met.
        const pattern = computePattern(mask, width, height, ni)
        pick = pickForestGid(lookup, pattern, rand) ?? 0
      }
      out[ni] = pick
      queue.push(ni)
    }
  }
  return out
}

function intersect(a: Set<number>, b: Set<number>): Set<number> {
  const out = new Set<number>()
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a]
  for (const v of smaller) if (larger.has(v)) out.add(v)
  return out
}

function sampleByFreq(entries: { gid: number; freq: number }[], rand: () => number): number {
  const total = entries.reduce((a, e) => a + e.freq, 0)
  let r = rand() * total
  for (const e of entries) {
    r -= e.freq
    if (r <= 0) return e.gid
  }
  return entries[entries.length - 1].gid
}

function computePattern(mask: Uint8Array, w: number, h: number, idx: number): number {
  const x = idx % w
  const y = Math.floor(idx / w)
  let pattern = 0
  if (y > 0 && mask[idx - w]) pattern |= 0b0001
  if (x < w - 1 && mask[idx + 1]) pattern |= 0b0010
  if (y < h - 1 && mask[idx + w]) pattern |= 0b0100
  if (x > 0 && mask[idx - 1]) pattern |= 0b1000
  return pattern
}

/** Return the gid Pita uses for this 4-side pattern, sampled by frequency. */
export function pickForestGid(
  lookup: ForestLookup,
  pattern: number,
  rand: () => number,
): number | null {
  let entries = lookup.byPattern.get(pattern)
  if (!entries || entries.length === 0) {
    // Fallback: try the closest pattern by Hamming distance.
    let best: { gid: number; freq: number }[] | null = null
    let bestDist = Infinity
    for (const [p, ents] of lookup.byPattern) {
      let d = 0
      let diff = p ^ pattern
      while (diff) {
        d += diff & 1
        diff >>= 1
      }
      if (d < bestDist) {
        bestDist = d
        best = ents
      }
    }
    entries = best ?? []
  }
  if (entries.length === 0) return null
  const total = entries.reduce((a, e) => a + e.freq, 0)
  let r = rand() * total
  for (const e of entries) {
    r -= e.freq
    if (r <= 0) return e.gid
  }
  return entries[entries.length - 1].gid
}
