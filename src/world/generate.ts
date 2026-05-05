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
  neighbors,
  rectCenter,
  rectHexes,
  type Axial,
} from '../hex/coords'
import { pickBiome, FEATURE_POOL, ENCOUNTERS } from './biomes'
import { fakeItemName, realItemName, regionName } from './names'
import { generateRumor } from './rumors'
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
  const seeds: Axial[] = [partyHex]
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
  const drafts: RegionDraft[] = seeds.map((c, index) => ({
    index,
    centerHex: c,
    hexKeys: new Set<string>(),
    draft: {
      name: regionName(rng),
      color: regionColor(index, rng),
      kingdom_lore: '',
      dm_lore: '',
      is_homeland: index === 0,
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
  for (const r of drafts) {
    r.draft.kingdom_lore = r.draft.is_homeland
      ? `${r.draft.name} — your homeland. Royal city, surrounding farmsteads, and the wild fringes you've grown up hearing tales about.`
      : pick(rng, [
          `A neighboring realm beyond the reach of ${drafts[0]?.draft.name ?? 'home'}.`,
          'Travelers speak of strange customs here.',
          'Sparsely settled, the few who live here keep to themselves.',
          'Once a great kingdom, now mostly ruins and outposts.',
          'Wilderness more than realm — only the foolhardy claim it.',
        ])
  }
  return drafts
}

function pickItemHexes(
  rng: Rng,
  all: Axial[],
  biomes: Map<string, Biome>,
  partyHex: Axial,
): Axial[] {
  const candidates = all
    .filter((h) => {
      const b = biomes.get(axialKey(h))
      return b === 'mountain' || b === 'swamp' || b === 'desert' || b === 'tundra' || b === 'forest'
    })
    .map((h) => ({ h, dist: axialDistance(h, partyHex) }))
    .filter((c) => c.dist >= 4)
    .sort((a, b) => b.dist - a.dist)
  const top = candidates.slice(0, Math.min(40, candidates.length))
  return shuffle(rng, top).map((c) => c.h)
}

function buildStormPath(
  rng: Rng,
  width: number,
  height: number,
  partyHex: Axial,
  biomes: Map<string, Biome>,
  maxDays: number,
): { start: Axial; path: Axial[] } {
  const edgeHexes: Axial[] = []
  for (let r = 0; r < height; r++) {
    const offset = -Math.floor(r / 2)
    edgeHexes.push({ q: offset, r })
    edgeHexes.push({ q: width - 1 + offset, r })
  }
  for (let qi = 0; qi < width; qi++) {
    edgeHexes.push({ q: qi, r: 0 })
    edgeHexes.push({ q: qi - Math.floor((height - 1) / 2), r: height - 1 })
  }
  const land = edgeHexes.filter((h) => biomes.get(axialKey(h)) !== 'ocean')
  const start = pick(rng, land.length ? land : edgeHexes)
  const path: Axial[] = []
  let cur = { ...start }
  for (let i = 0; i < maxDays; i++) {
    path.push({ ...cur })
    if (cur.q === partyHex.q && cur.r === partyHex.r) break
    const ns = neighbors(cur)
    let bestNext = ns[0]
    let bestD = Infinity
    for (const n of ns) {
      const d = axialDistance(n, partyHex)
      if (d < bestD) {
        bestD = d
        bestNext = n
      }
    }
    cur = bestNext
  }
  return { start, path }
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
    const encounters = shuffle(rng, ENCOUNTERS[biome] ?? [])
      .slice(0, randInt(rng, 2, 3))
      .map((text) => ({ weight: 1, text }))
    const isHomeland = regions[hexRegionIndex.get(k) ?? -1]?.draft.is_homeland ?? false
    return {
      q: h.q,
      r: h.r,
      biome,
      region_id: null,
      generated: { features, encounters },
      dm_notes: '',
      revealed: isHomeland,
      party_visited: h.q === partyHex.q && h.r === partyHex.r,
    }
  })
  const candidates = pickItemHexes(rng, all, biomes, partyHex)
  const realCount = Math.min(10, candidates.length)
  const fakeCount = Math.min(5, Math.max(0, candidates.length - realCount))
  const realHexes = candidates.slice(0, realCount)
  const fakeHexes = candidates.slice(realCount, realCount + fakeCount)
  const items: Omit<ItemRow, 'campaign_id' | 'id'>[] = []
  const itemRegionIdx: (number | null)[] = []
  for (const h of realHexes) {
    items.push({
      name: realItemName(rng),
      description: '',
      hex_q: h.q,
      hex_r: h.r,
      is_real: true,
      discovered: false,
      in_party_inventory: false,
    })
    itemRegionIdx.push(hexRegionIndex.get(axialKey(h)) ?? null)
  }
  for (const h of fakeHexes) {
    items.push({
      name: fakeItemName(rng),
      description: '',
      hex_q: h.q,
      hex_r: h.r,
      is_real: false,
      discovered: false,
      in_party_inventory: false,
    })
    itemRegionIdx.push(hexRegionIndex.get(axialKey(h)) ?? null)
  }
  const rumors: GeneratedWorld['rumors'] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const ridx = itemRegionIdx[i]
    const itemRegion = ridx != null ? regions[ridx].draft : undefined
    const sources = shuffle(rng, regions).slice(0, randInt(rng, 1, 3))
    for (const src of sources) {
      const text = generateRumor(
        {
          item: { name: item.name, is_real: item.is_real },
          itemRegion: itemRegion as RegionRow | undefined,
          allRegions: regions.map((r) => r.draft as RegionRow),
        },
        src.draft as RegionRow,
        rng,
      )
      rumors.push({
        text,
        is_true: item.is_real,
        target_q: item.hex_q,
        target_r: item.hex_r,
        collected: false,
        source_region_index: src.index,
      })
    }
  }
  const storm = buildStormPath(rng, opts.width, opts.height, partyHex, biomes, maxDays)
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
      storm_radius: 1,
      storm_path: storm.path,
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
