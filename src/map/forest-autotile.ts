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
 *
 * The lookup maps each pattern to the set of tile gids Pita actually used
 * for that pattern, weighted by frequency.
 */
export interface ForestLookup {
  /** pattern (0..15) → array of (gid, frequency) entries. */
  byPattern: Map<number, { gid: number; freq: number }[]>
}

let cached: ForestLookup | null = null

const SOURCES = ['Scenes.tmx', 'GuideExamples.tmx']

export async function loadForestLookup(base: string): Promise<ForestLookup> {
  if (cached) return cached
  const counts = new Map<number, Map<number, number>>() // pattern → (gid → count)
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
    // Look at every layer — Pita places tree sprites in over/mid layers.
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
  cached = { byPattern }
  return cached
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
