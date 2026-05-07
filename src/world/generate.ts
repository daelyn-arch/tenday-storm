import { createNoise2D } from 'simplex-noise'
import type {
  Biome,
  CampaignRow,
  HexRow,
  ItemRow,
  RegionRow,
  RumorRow,
} from '../types/db'
import {
  NEIGHBORS,
  axialDistance,
  axialKey,
  hexToPixel,
  neighbors,
  rectCenter,
  rectHexes,
  type Axial,
} from '../hex/coords'
import { pickBiome, FEATURE_POOL } from './biomes'
import { regionName } from './names'
import { makeRng, pick, randInt, shuffle, type Rng } from './rng'

export interface GenerateOptions {
  name: string
  seed: number
  width: number
  height: number
  maxDays?: number
}

export interface GeneratedWorld {
  campaign: Pick<
    CampaignRow,
    | 'name'
    | 'seed'
    | 'width'
    | 'height'
    | 'day'
    | 'max_days'
    | 'party_q'
    | 'party_r'
    | 'storm_q'
    | 'storm_r'
    | 'storm_radius'
    | 'storm_path'
    | 'players_see_storm_next'
    | 'final_boss_q'
    | 'final_boss_r'
    | 'invite_code'
  >
  hexes: Omit<HexRow, 'campaign_id'>[]
  regions: Omit<RegionRow, 'campaign_id' | 'id'>[]
  items: Omit<ItemRow, 'campaign_id' | 'id'>[]
  rumors: (Omit<RumorRow, 'campaign_id' | 'id' | 'source_region_id'> & {
    source_region_index: number | null
  })[]
  /** hexKey "q,r" → index into regions[] (so caller can patch hex.region_id once region UUIDs exist) */
  hexRegionIndex: Map<string, number>
}

interface RegionDraft {
  index: number
  centerHex: Axial
  hexKeys: Set<string>
  draft: Omit<RegionRow, 'campaign_id' | 'id'>
  /** Primary biome assigned to this region (set during unifyRegionBiomes). */
  primaryBiome?: Biome
}

const REGION_TARGET_PER_HEXES = 32

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function makeNoise2(seed: number) {
  const rng = makeRng(seed)
  return createNoise2D(rng)
}

function edgeFalloff(x: number, y: number, w: number, h: number): number {
  const dx = Math.min(x, w - 1 - x) / (w / 2)
  const dy = Math.min(y, h - 1 - y) / (h / 2)
  return clamp(Math.min(dx, dy) * 1.4, 0, 1)
}

function generateBiomes(opts: GenerateOptions, all: Axial[]): Map<string, Biome> {
  const elev = makeNoise2(opts.seed)
  const moist = makeNoise2(opts.seed ^ 0x9e3779b1)
  const out = new Map<string, Biome>()
  const ef = 0.085
  const mf = 0.13
  const inBounds = new Set(all.map(axialKey))
  for (const h of all) {
    const { x, y } = hexToPixel(h, 1)
    const e0 = (elev(x * ef, y * ef) + 1) / 2
    const m0 = (moist(x * mf, y * mf) + 1) / 2
    const fall = edgeFalloff(h.q + Math.floor(h.r / 2), h.r, opts.width, opts.height)
    const elevation = clamp(e0 * 0.6 + fall * 0.55, 0, 1)
    const lat = Math.abs(h.r - opts.height / 2) / (opts.height / 2)
    out.set(axialKey(h), pickBiome(elevation, m0, lat))
  }
  // Force the entire map perimeter to ocean — every edge tile is sea, so the
  // landmass always sits framed by water.
  for (const h of all) {
    for (const n of neighbors(h)) {
      if (!inBounds.has(axialKey(n))) {
        out.set(axialKey(h), 'ocean')
        break
      }
    }
  }
  // Tundra only exists near mountains (cold peaks bleed ice/snow into the
  // surrounding tiles). Any tundra hex without a mountain neighbor demotes
  // to plains.
  for (const h of all) {
    if (out.get(axialKey(h)) !== 'tundra') continue
    let mountainAdj = false
    for (const n of neighbors(h)) {
      if (out.get(axialKey(n)) === 'mountain') {
        mountainAdj = true
        break
      }
    }
    if (!mountainAdj) out.set(axialKey(h), 'plains')
  }
  // Hard rule: desert can never neighbor tundra (any clash → desert demotes
  // to plains, since tundra's mountain anchor is the more meaningful feature).
  for (const h of all) {
    if (out.get(axialKey(h)) !== 'desert') continue
    for (const n of neighbors(h)) {
      if (out.get(axialKey(n)) === 'tundra') {
        out.set(axialKey(h), 'plains')
        break
      }
    }
  }
  // Coast tiles should sit on an actual shoreline. Strip any coast hex that
  // isn't adjacent to ocean.
  for (const h of all) {
    if (out.get(axialKey(h)) !== 'coast') continue
    let oceanAdj = false
    for (const n of neighbors(h)) {
      if (out.get(axialKey(n)) === 'ocean') {
        oceanAdj = true
        break
      }
    }
    if (!oceanAdj) out.set(axialKey(h), 'plains')
  }
  // Smooth speckly swamp biomes (tiny isolated patches look like noise).
  eraseSmallClusters(out, all, 'swamp', 3)
  smoothDeserts(out, all)
  return out
}

// Desert rule:
//   - Clusters of 2-3 hexes look like fragmented noise → demote to plains.
//   - Clusters of size 1 or 4+ are kept.
//   - Every pair of remaining desert clusters must be at least 5 hexes apart;
//     when two clusters sit closer than that the smaller of the two is
//     demoted, then we re-scan in case the demotion made another pair valid.
//     This catches solo-near-solo, solo-near-tract, AND tract-near-tract.
function smoothDeserts(biomes: Map<string, Biome>, all: Axial[]) {
  const minDistance = 5

  function findClusters(): Axial[][] {
    const clusters: Axial[][] = []
    const visited = new Set<string>()
    for (const h of all) {
      if (biomes.get(axialKey(h)) !== 'desert' || visited.has(axialKey(h))) continue
      const cluster: Axial[] = []
      const queue = [h]
      visited.add(axialKey(h))
      while (queue.length) {
        const cur = queue.shift()!
        cluster.push(cur)
        for (const n of neighbors(cur)) {
          const nk = axialKey(n)
          if (visited.has(nk) || biomes.get(nk) !== 'desert') continue
          visited.add(nk)
          queue.push(n)
        }
      }
      clusters.push(cluster)
    }
    return clusters
  }

  function demote(cluster: Axial[]) {
    for (const h of cluster) biomes.set(axialKey(h), 'plains')
  }

  function clustersDistance(a: Axial[], b: Axial[]): number {
    let min = Infinity
    for (const ha of a) {
      for (const hb of b) {
        const d = axialDistance(ha, hb)
        if (d < min) min = d
      }
    }
    return min
  }

  // Pass 1: nuke 2-3 sized clusters.
  for (const c of findClusters()) {
    if (c.length >= 2 && c.length < 4) demote(c)
  }

  // Pass 2: iteratively enforce inter-cluster spacing.
  let changed = true
  while (changed) {
    changed = false
    const clusters = findClusters()
    for (let i = 0; i < clusters.length && !changed; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (clustersDistance(clusters[i], clusters[j]) < minDistance) {
          if (clusters[i].length <= clusters[j].length) demote(clusters[i])
          else demote(clusters[j])
          changed = true
          break
        }
      }
    }
  }
}

function eraseSmallClusters(
  biomes: Map<string, Biome>,
  all: Axial[],
  target: Biome,
  minSize: number,
  replacement: Biome = 'plains',
) {
  const visited = new Set<string>()
  for (const h of all) {
    const k = axialKey(h)
    if (visited.has(k)) continue
    if (biomes.get(k) !== target) continue
    const cluster: Axial[] = []
    const queue: Axial[] = [h]
    visited.add(k)
    while (queue.length) {
      const cur = queue.shift()!
      cluster.push(cur)
      for (const n of neighbors(cur)) {
        const nk = axialKey(n)
        if (visited.has(nk)) continue
        if (biomes.get(nk) !== target) continue
        visited.add(nk)
        queue.push(n)
      }
    }
    if (cluster.length < minSize) {
      for (const c of cluster) biomes.set(axialKey(c), replacement)
    }
  }
}

function regionColor(index: number, rng: Rng): string {
  const hue = (index * 47 + Math.floor(rng() * 10)) % 360
  return `hsl(${hue}, 55%, 60%)`
}

function placeRegions(
  rng: Rng,
  all: Axial[],
  biomes: Map<string, Biome>,
  partyHex: Axial,
): RegionDraft[] {
  const land = all.filter((h) => biomes.get(axialKey(h)) !== 'ocean')
  const targetCount = Math.max(4, Math.floor(land.length / REGION_TARGET_PER_HEXES))
  // Anchoring the first seed at the party hex makes the homeland balloon to
  // dominate the map (every other seed gets pushed to the edges by maximin).
  // Instead, scatter all seeds evenly via maximin and tag whichever region
  // happens to contain the party hex as the homeland after the fact.
  const seeds: Axial[] = [pick(rng, land)]
  while (seeds.length < targetCount) {
    let best: Axial | null = null
    let bestMin = -Infinity
    const sample = shuffle(rng, land).slice(0, Math.min(land.length, 250))
    for (const c of sample) {
      let minD = Infinity
      for (const s of seeds) minD = Math.min(minD, axialDistance(c, s))
      if (minD > bestMin) {
        bestMin = minD
        best = c
      }
    }
    if (!best) break
    seeds.push(best)
  }
  // Identify the seed nearest to the party — that region is the homeland.
  let homelandIndex = 0
  let homelandDist = Infinity
  for (let i = 0; i < seeds.length; i++) {
    const d = axialDistance(seeds[i], partyHex)
    if (d < homelandDist) {
      homelandDist = d
      homelandIndex = i
    }
  }
  const drafts: RegionDraft[] = seeds.map((c, index) => ({
    index,
    centerHex: c,
    hexKeys: new Set<string>(),
    draft: {
      name: regionName(rng),
      color: regionColor(index, rng),
      kingdom_lore: '',
      dm_lore: '',
      is_homeland: index === homelandIndex,
    },
  }))
  for (const h of land) {
    let nearest = 0
    let nd = Infinity
    for (let i = 0; i < seeds.length; i++) {
      const d = axialDistance(h, seeds[i])
      if (d < nd) {
        nd = d
        nearest = i
      }
    }
    drafts[nearest].hexKeys.add(axialKey(h))
  }
  // Cap the homeland to a small starting pocket (1-7 hexes, random) so the
  // party doesn't begin with a giant safe zone. Keep the hexes closest to the
  // party hex; evict the rest to whichever non-homeland seed they're nearest to.
  const homelandCap = randInt(rng, 1, 7)
  const homeland = drafts[homelandIndex]
  if (homeland && homeland.hexKeys.size > homelandCap) {
    const sorted = Array.from(homeland.hexKeys).sort((a, b) => {
      const [aq, ar] = a.split(',').map(Number)
      const [bq, br] = b.split(',').map(Number)
      return (
        axialDistance({ q: aq, r: ar }, partyHex) - axialDistance({ q: bq, r: br }, partyHex)
      )
    })
    const keep = new Set(sorted.slice(0, homelandCap))
    const evicted = sorted.slice(homelandCap)
    for (const k of evicted) {
      const [q, r] = k.split(',').map(Number)
      let nearest = -1
      let nd = Infinity
      for (let i = 0; i < seeds.length; i++) {
        if (i === homelandIndex) continue
        const d = axialDistance({ q, r }, seeds[i])
        if (d < nd) {
          nd = d
          nearest = i
        }
      }
      if (nearest >= 0) drafts[nearest].hexKeys.add(k)
    }
    homeland.hexKeys = keep
  }
  const homelandName = drafts[homelandIndex]?.draft.name ?? 'home'
  for (const r of drafts) {
    r.draft.kingdom_lore = r.draft.is_homeland
      ? `${r.draft.name} — your homeland. Royal city, surrounding farmsteads, and the wild fringes you've grown up hearing tales about.`
      : pick(rng, [
          `A neighboring realm beyond the reach of ${homelandName}.`,
          'Travelers speak of strange customs here.',
          'Sparsely settled, the few who live here keep to themselves.',
          'Once a great kingdom, now mostly ruins and outposts.',
          'Wilderness more than realm — only the foolhardy claim it.',
        ])
  }
  return drafts
}

// Each region gets a deliberate primary biome based on the climate band of
// its center, so the map reads as "the desert kingdom", "the forest realm",
// "the swamp wastes", etc. Every "soft" land hex inside the region is
// overwritten to that biome. Geographical features — ocean, coast, mountain,
// tundra — are preserved because they reflect the underlying terrain, not
// regional culture. After unification, any new desert hex bordering tundra
// demotes to plains so the no-clash rule still holds.
function unifyRegionBiomes(
  regions: RegionDraft[],
  biomes: Map<string, Biome>,
  height: number,
  rng: Rng,
) {
  const PROTECTED: Biome[] = ['ocean', 'coast', 'mountain', 'tundra']
  for (const region of regions) {
    const lat = Math.abs(region.centerHex.r - height / 2) / (height / 2)
    let pool: Biome[]
    if (lat > 0.6) {
      // Cold band — boreal-ish.
      pool = ['forest', 'plains', 'hills']
    } else if (lat < 0.35) {
      // Warm band — desert is on the table.
      pool = ['desert', 'plains', 'forest', 'swamp']
    } else {
      // Temperate band.
      pool = ['plains', 'forest', 'hills', 'swamp']
    }
    const primary = pick(rng, pool)
    region.primaryBiome = primary
    for (const k of region.hexKeys) {
      const b = biomes.get(k)
      if (!b || PROTECTED.includes(b)) continue
      biomes.set(k, primary)
    }
  }
  // Cleanup: any desert hex sitting next to tundra demotes back to plains.
  for (const k of Array.from(biomes.keys())) {
    if (biomes.get(k) !== 'desert') continue
    const [q, r] = k.split(',').map(Number)
    for (const n of neighbors({ q, r })) {
      if (biomes.get(axialKey(n)) === 'tundra') {
        biomes.set(k, 'plains')
        break
      }
    }
  }
  // Re-run desert smoothing now that region unification may have created
  // small clusters or pairs that previously didn't exist.
  const all = Array.from(biomes.keys()).map((k) => {
    const [q, r] = k.split(',').map(Number)
    return { q, r }
  })
  smoothDeserts(biomes, all)
}

// Rivers always start at a mountain hex (the source) and flow downhill to a
// shoreline (a land tile adjacent to ocean), winding through other land
// (mountains and ocean impassable along the route). At the shoreline endpoint
// we add the ocean-facing edge so the river visually empties into the sea.
function generateRivers(
  rng: Rng,
  all: Axial[],
  biomes: Map<string, Biome>,
): Map<string, number[]> {
  const out = new Map<string, number[]>()
  const inBounds = new Set(all.map((h) => axialKey(h)))

  const mountains = all.filter((h) => biomes.get(axialKey(h)) === 'mountain')
  if (!mountains.length) return out

  // Cache the first ocean-facing edge of each shoreline (land adjacent to
  // ocean) hex so we can flow the river visually into the sea at the end.
  const oceanEdgeByHex = new Map<string, number>()
  for (const h of all) {
    const b = biomes.get(axialKey(h))
    if (!b || b === 'ocean' || b === 'mountain') continue
    for (let e = 0; e < NEIGHBORS.length; e++) {
      const n = { q: h.q + NEIGHBORS[e].q, r: h.r + NEIGHBORS[e].r }
      if (biomes.get(axialKey(n)) === 'ocean') {
        oceanEdgeByHex.set(axialKey(h), e)
        break
      }
    }
  }
  if (oceanEdgeByHex.size === 0) return out
  const shorelineKeys = new Set(oceanEdgeByHex.keys())

  function dirFromTo(from: Axial, to: Axial): number {
    for (let i = 0; i < NEIGHBORS.length; i++) {
      if (from.q + NEIGHBORS[i].q === to.q && from.r + NEIGHBORS[i].r === to.r) return i
    }
    return -1
  }

  // BFS from a mountain source to the nearest shoreline hex. The mountain
  // start is included in the path; subsequent hexes must be land (no
  // mountains, no ocean).
  function bfsFromMountain(start: Axial): Axial[] | null {
    const visited = new Set<string>([axialKey(start)])
    type Node = { hex: Axial; parent: Node | null }
    const queue: Node[] = [{ hex: start, parent: null }]
    while (queue.length) {
      const node = queue.shift()!
      for (const n of neighbors(node.hex)) {
        const nk = axialKey(n)
        if (!inBounds.has(nk) || visited.has(nk)) continue
        const b = biomes.get(nk)
        if (!b) continue
        if (b === 'mountain' || b === 'ocean') continue
        visited.add(nk)
        if (shorelineKeys.has(nk)) {
          const path: Axial[] = [n]
          let cur: Node | null = node
          while (cur) {
            path.unshift(cur.hex)
            cur = cur.parent
          }
          return path
        }
        queue.push({ hex: n, parent: node })
      }
    }
    return null
  }

  const sourceCount = randInt(rng, 2, 4)
  const candidatePool = shuffle(rng, mountains)
  const used: Axial[] = []

  for (const src of candidatePool) {
    if (used.length >= sourceCount) break
    if (used.some((u) => axialDistance(u, src) < 4)) continue

    const path = bfsFromMountain(src)
    if (!path || path.length < 2) continue

    // Mark edges along the path.
    for (let i = 0; i < path.length; i++) {
      const cur = path[i]
      const k = axialKey(cur)
      const edges = out.get(k) ?? []
      if (i > 0) {
        const d = dirFromTo(cur, path[i - 1])
        if (d >= 0 && !edges.includes(d)) edges.push(d)
      }
      if (i < path.length - 1) {
        const d = dirFromTo(cur, path[i + 1])
        if (d >= 0 && !edges.includes(d)) edges.push(d)
      }
      out.set(k, edges)
    }

    // Shoreline endpoint: add the ocean-facing edge so the river visually
    // empties into the sea. Mountain endpoint just renders as a stub at the
    // peak (no extra edge added — looks like the river bursting from a glacier).
    {
      const endpoint = path[path.length - 1]
      const k = axialKey(endpoint)
      const oceanEdge = oceanEdgeByHex.get(k)
      if (oceanEdge != null) {
        const edges = out.get(k) ?? []
        if (!edges.includes(oceanEdge)) edges.push(oceanEdge)
        out.set(k, edges)
      }
    }

    used.push(src)
  }
  return out
}

// The storm has no trajectory — each day it teleports to a new random land hex.
// We pre-roll maxDays of jumps so DMs (and players, if the tracker toggle is on)
// can see the next-day destination, but past that the path stays a surprise.
// Avoids the party's starting hex and tries not to land on the same spot twice
// in a row, but otherwise no constraints.
function buildStormPath(
  rng: Rng,
  all: Axial[],
  partyHex: Axial,
  biomes: Map<string, Biome>,
  maxDays: number,
): { start: Axial; path: Axial[] } {
  const land = all.filter(
    (h) => biomes.get(axialKey(h)) !== 'ocean' && !(h.q === partyHex.q && h.r === partyHex.r),
  )
  const pool = land.length ? land : all
  function rollDistinct(prev: Axial | null): Axial {
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = pick(rng, pool)
      if (!prev || candidate.q !== prev.q || candidate.r !== prev.r) return candidate
    }
    return pick(rng, pool)
  }
  const path: Axial[] = []
  let prev: Axial | null = null
  for (let i = 0; i < maxDays; i++) {
    const next = rollDistinct(prev)
    path.push(next)
    prev = next
  }
  return { start: path[0], path }
}

export function generateWorld(opts: GenerateOptions): GeneratedWorld {
  const maxDays = opts.maxDays ?? 10
  const rng = makeRng(opts.seed)
  const all = rectHexes(opts.width, opts.height)
  const biomes = generateBiomes(opts, all)
  let partyHex = rectCenter(opts.width, opts.height)
  if (biomes.get(axialKey(partyHex)) === 'ocean') {
    let best = partyHex
    let bestD = Infinity
    for (const h of all) {
      if (biomes.get(axialKey(h)) === 'ocean') continue
      const d = axialDistance(h, partyHex)
      if (d < bestD) {
        bestD = d
        best = h
      }
    }
    partyHex = best
  }
  const regions = placeRegions(rng, all, biomes, partyHex)
  const hexRegionIndex = new Map<string, number>()
  regions.forEach((r) => r.hexKeys.forEach((k) => hexRegionIndex.set(k, r.index)))
  unifyRegionBiomes(regions, biomes, opts.height, rng)
  const rivers = generateRivers(rng, all, biomes)
  const hexRows: Omit<HexRow, 'campaign_id'>[] = all.map((h) => {
    const k = axialKey(h)
    const biome = biomes.get(k) ?? 'plains'
    const features = shuffle(rng, FEATURE_POOL[biome] ?? []).slice(0, randInt(rng, 1, 2))
    const isHomeland = regions[hexRegionIndex.get(k) ?? -1]?.draft.is_homeland ?? false
    const riverEdges = rivers.get(k)
    return {
      q: h.q,
      r: h.r,
      biome,
      region_id: null,
      // Encounters are no longer auto-rolled per hex — DMs add them via the
      // Encounters panel and assign to a tile when needed.
      generated: riverEdges ? { features, rivers: riverEdges } : { features },
      dm_notes: '',
      revealed: isHomeland,
      party_visited: h.q === partyHex.q && h.r === partyHex.r,
      location_type: null,
    }
  })
  // Items + rumors are intentionally DM-driven now: the wizard creates none,
  // and the DM populates them via the Items / Rumors panels at play time.
  const items: Omit<ItemRow, 'campaign_id' | 'id'>[] = []
  const rumors: GeneratedWorld['rumors'] = []
  const storm = buildStormPath(rng, all, partyHex, biomes, maxDays)
  const code = Array.from({ length: 6 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(rng() * 32)],
  ).join('')
  const finalBoss = storm.path[storm.path.length - 1] ?? partyHex
  return {
    campaign: {
      name: opts.name,
      seed: opts.seed,
      width: opts.width,
      height: opts.height,
      day: 1,
      max_days: maxDays,
      party_q: partyHex.q,
      party_r: partyHex.r,
      storm_q: storm.start.q,
      storm_r: storm.start.r,
      storm_radius: 3,
      storm_path: storm.path,
      players_see_storm_next: false,
      final_boss_q: finalBoss.q,
      final_boss_r: finalBoss.r,
      invite_code: code,
    },
    hexes: hexRows,
    regions: regions.map((r) => r.draft),
    items,
    rumors,
    hexRegionIndex,
  }
}
