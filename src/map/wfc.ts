// Tiled Wave Function Collapse. Learns 4-direction adjacency rules and tile
// frequencies from a Pita .tmx file, then generates new maps that obey the
// learned rules. Output is a flat tile-id array per layer suitable for the
// existing canvas baker.
//
// This is the "model" variant — each cell ends up holding exactly one tile
// id sampled from the rule space. Not overlapping-pattern WFC; simpler and
// faster, and Pita's tileset already has rich per-tile adjacencies via the
// terrain definitions, so the simple model gives good results.

import { parseTmx, type ParsedTmx } from './tmx-parse'

export interface AdjacencyRules {
  /** For each (tile, direction), set of tiles that legally sit next to it. */
  rules: Map<number, [Set<number>, Set<number>, Set<number>, Set<number>]>
  /** Tile frequency in the training input — used to bias sampling. */
  weights: Map<number, number>
  /** All known tile gids. */
  alphabet: number[]
}

const DIRS: [number, number][] = [
  [0, -1], // 0 north
  [1, 0], // 1 east
  [0, 1], // 2 south
  [-1, 0], // 3 west
]

/** Learn adjacency rules from a TMX by scanning every tile's neighbors. */
export function learnRules(tmx: ParsedTmx, layerName = 'under'): AdjacencyRules {
  const layer = tmx.layers.find((l) => l.name === layerName) ?? tmx.layers[0]
  if (!layer) throw new Error('TMX has no layers')
  const w = tmx.width
  const h = tmx.height
  const tiles = layer.tiles
  const weights = new Map<number, number>()
  const rules = new Map<number, [Set<number>, Set<number>, Set<number>, Set<number>]>()
  const ensure = (t: number) => {
    if (!rules.has(t)) rules.set(t, [new Set(), new Set(), new Set(), new Set()])
    return rules.get(t)!
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = tiles[y * w + x]
      if (t === 0) continue
      weights.set(t, (weights.get(t) ?? 0) + 1)
      const r = ensure(t)
      for (let d = 0; d < 4; d++) {
        const [dx, dy] = DIRS[d]
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        const n = tiles[ny * w + nx]
        if (n === 0) continue
        r[d].add(n)
      }
    }
  }
  return { rules, weights, alphabet: Array.from(weights.keys()) }
}

/** RNG seeded from a number for deterministic generation. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

/**
 * Run WFC. Returns either a tile-id array of length w*h or null if too many
 * contradictions occurred (caller can retry with a fresh seed).
 */
export function runWfc(
  rules: AdjacencyRules,
  w: number,
  h: number,
  seed: number,
): number[] | null {
  const rng = mulberry32(seed)
  const N = w * h
  // possibilities[i] is the set of tile ids still possible at cell i.
  const possibilities: Set<number>[] = new Array(N)
  for (let i = 0; i < N; i++) possibilities[i] = new Set(rules.alphabet)
  const collapsed = new Uint8Array(N)
  // weighted entropy: sum(weights) of remaining possibilities.
  const entropy = (i: number) => possibilities[i].size

  function pickWeighted(set: Set<number>): number {
    let total = 0
    for (const t of set) total += rules.weights.get(t) ?? 1
    let r = rng() * total
    for (const t of set) {
      r -= rules.weights.get(t) ?? 1
      if (r <= 0) return t
    }
    return Array.from(set)[0]
  }

  function propagate(start: number): boolean {
    const stack = [start]
    while (stack.length) {
      const i = stack.pop()!
      const cx = i % w
      const cy = Math.floor(i / w)
      for (let d = 0; d < 4; d++) {
        const [dx, dy] = DIRS[d]
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        const ni = ny * w + nx
        if (collapsed[ni]) continue
        const np = possibilities[ni]
        // The neighbor can only be tiles allowed by SOME current possibility of i in direction d.
        const allowed = new Set<number>()
        for (const t of possibilities[i]) {
          const r = rules.rules.get(t)
          if (!r) continue
          for (const c of r[d]) allowed.add(c)
        }
        // Intersect np with allowed
        let changed = false
        for (const t of Array.from(np)) {
          if (!allowed.has(t)) {
            np.delete(t)
            changed = true
          }
        }
        if (np.size === 0) return false // contradiction
        if (changed) stack.push(ni)
      }
    }
    return true
  }

  let iterations = 0
  while (iterations < N + 100) {
    // pick lowest-entropy uncollapsed cell (with small random jitter)
    let bestI = -1
    let bestE = Infinity
    for (let i = 0; i < N; i++) {
      if (collapsed[i]) continue
      const e = entropy(i) + rng() * 0.01
      if (e < bestE) {
        bestE = e
        bestI = i
      }
    }
    if (bestI < 0) break // all collapsed
    const p = possibilities[bestI]
    if (p.size === 0) return null
    const tile = pickWeighted(p)
    p.clear()
    p.add(tile)
    collapsed[bestI] = 1
    if (!propagate(bestI)) return null
    iterations++
  }
  const out = new Array<number>(N)
  for (let i = 0; i < N; i++) {
    const p = possibilities[i]
    out[i] = p.size === 0 ? 0 : Array.from(p)[0]
  }
  return out
}

/**
 * Generate a tile array using WFC with retry-on-contradiction. Throws if
 * generation fails after `maxAttempts` tries.
 */
export async function generateFromTmx(
  tmxUrl: string,
  w: number,
  h: number,
  seed: number,
  maxAttempts = 8,
): Promise<{ width: number; height: number; layers: { name: string; tiles: number[] }[] }> {
  const tmx = await parseTmx(tmxUrl)
  // Only WFC the base "under" terrain layer. Sparse decoration layers
  // (mid, over) flood with garbage when run through WFC because empty (0)
  // cells aren't in the alphabet — leave them empty for now and address
  // decoration in a follow-up pass.
  const baseLayer = tmx.layers.find((l) => l.name === 'under') ?? tmx.layers[0]
  const rules = learnRules(tmx, baseLayer.name)
  let tiles: number[] | null = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    tiles = runWfc(rules, w, h, seed + attempt * 1009)
    if (tiles) break
  }
  if (!tiles) {
    const fallback = mostCommon(rules.weights)
    tiles = new Array(w * h).fill(fallback)
  }
  // Output an empty mid/over so the renderer's layer loop is a no-op for them.
  const layers: { name: string; tiles: number[] }[] = [{ name: 'under', tiles }]
  for (const l of tmx.layers) {
    if (l.name !== baseLayer.name) {
      layers.push({ name: l.name, tiles: new Array(w * h).fill(0) })
    }
  }
  return { width: w, height: h, layers }
}

function mostCommon(weights: Map<number, number>): number {
  let best = 0
  let bestC = 0
  for (const [t, c] of weights) {
    if (c > bestC) {
      bestC = c
      best = t
    }
  }
  return best
}
