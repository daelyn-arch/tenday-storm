// Multi-tile structure stamps extracted from Pita's hand-crafted Scenes.tmx.
// At runtime we read the TMX, slice out each named region by tile coords,
// and the generator stamps copies into procedural maps. This bridges
// "procedural macro layout" with "hand-crafted micro detail."

import { parseTmx, type ParsedTmx } from './tmx-parse'

export interface Stamp {
  name: string
  width: number
  height: number
  /** Per-layer tile gids, length = width*height. layers[0] = "under", etc. */
  layers: { name: string; tiles: number[] }[]
}

/** Region definitions — manually picked from a render of Scenes.tmx. */
export interface StampRegion {
  name: string
  x: number
  y: number
  w: number
  h: number
}

export const STAMP_REGIONS: StampRegion[] = [
  // Top-left scene — small walled fortress on a peninsula.
  { name: 'fortress', x: 1, y: 1, w: 16, h: 13 },
  // Top-middle — cliff plateau with a single watchtower.
  { name: 'watchtower', x: 28, y: 6, w: 4, h: 6 },
  // Top-right — river-with-bridges scene; pull just the bridge crossing.
  { name: 'bridge', x: 50, y: 5, w: 6, h: 4 },
  // Bottom-middle — large walled city.
  { name: 'walled_city', x: 16, y: 28, w: 19, h: 18 },
  // Small island scene — single cabin + tree.
  { name: 'cabin', x: 7, y: 30, w: 5, h: 4 },
]

let cachedStamps: Map<string, Stamp> | null = null

export async function loadStamps(base: string): Promise<Map<string, Stamp>> {
  if (cachedStamps) return cachedStamps
  const parsed = await parseTmx(`${base}textures/_pita/Scenes.tmx`)
  const out = new Map<string, Stamp>()
  for (const region of STAMP_REGIONS) {
    out.set(region.name, extractStamp(parsed, region))
  }
  cachedStamps = out
  return out
}

function extractStamp(map: ParsedTmx, region: StampRegion): Stamp {
  const layers: Stamp['layers'] = []
  for (const layer of map.layers) {
    const tiles = new Array(region.w * region.h).fill(0)
    for (let dy = 0; dy < region.h; dy++) {
      for (let dx = 0; dx < region.w; dx++) {
        const sx = region.x + dx
        const sy = region.y + dy
        if (sx < 0 || sx >= map.width || sy < 0 || sy >= map.height) continue
        tiles[dy * region.w + dx] = layer.tiles[sy * map.width + sx]
      }
    }
    layers.push({ name: layer.name, tiles })
  }
  return { name: region.name, width: region.w, height: region.h, layers }
}
