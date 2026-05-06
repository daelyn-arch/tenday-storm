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
  axialDistance,
  axialKey,
  hexToPixel,
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
  for (const h of all) {
    const { x, y } = hexToPixel(h, 1)
    const e0 = (elev(x * ef, y * ef) + 1) / 2
    const m0 = (moist(x * mf, y * mf) + 1) / 2
    const fall = edgeFalloff(h.q + Math.floor(h.r / 2), h.r, opts.width, opts.height)
    const elevation = clamp(e0 * 0.6 + fall * 0.55, 0, 1)
    const lat = Math.abs(h.r - opts.height / 2) / (opts.height / 2)
    out.set(axialKey(h), pickBiome(elevation, m0, lat))
  }
  return out
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
  const hexRows: Omit<HexRow, 'campaign_id'>[] = all.map((h) => {
    const k = axialKey(h)
    const biome = biomes.get(k) ?? 'plains'
    const features = shuffle(rng, FEATURE_POOL[biome] ?? []).slice(0, randInt(rng, 1, 2))
    const isHomeland = regions[hexRegionIndex.get(k) ?? -1]?.draft.is_homeland ?? false
    return {
      q: h.q,
      r: h.r,
      biome,
      region_id: null,
      // Encounters are no longer auto-rolled per hex — DMs add them via the
      // Encounters panel and assign to a tile when needed.
      generated: { features },
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
