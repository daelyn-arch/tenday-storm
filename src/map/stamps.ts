// Multi-tile structure stamps extracted from Pita's hand-crafted Scenes.tmx.
// Stamps are SPARSE — we keep only non-empty cells from the mid/over layers,
// so when we paint a stamp into a procedural map the underlying terrain
// stays visible (no "TMX background grass" bleeding through).

import { parseTmx } from './tmx-parse'

export interface SparseStampCell {
  dx: number
  dy: number
  gid: number
}

export interface Stamp {
  name: string
  /** Bounding-box size; used to reserve clearance and avoid overlaps. */
  width: number
  height: number
  /** Only non-zero structure tiles. Caller paints these over base terrain. */
  cells: SparseStampCell[]
}

/** Region definitions — manually picked from Scenes.tmx (65×55). */
export interface StampRegion {
  name: string
  x: number
  y: number
  w: number
  h: number
}

export const STAMP_REGIONS: StampRegion[] = [
  // Small walled fortress on a peninsula (top-left scene).
  { name: 'fortress', x: 1, y: 1, w: 16, h: 13 },
  // Cliff plateau with a single watchtower (top-middle).
  { name: 'watchtower', x: 28, y: 6, w: 4, h: 6 },
  // Big walled city (bottom-middle).
  { name: 'walled_city', x: 16, y: 28, w: 19, h: 18 },
  // Small cabin (small-island scene).
  { name: 'cabin', x: 7, y: 30, w: 5, h: 4 },
]

let cachedStamps: Map<string, Stamp> | null = null

export async function loadStamps(base: string): Promise<Map<string, Stamp>> {
  if (cachedStamps) return cachedStamps
  const parsed = await parseTmx(`${base}textures/_pita/Scenes.tmx`)
  const out = new Map<string, Stamp>()
  // Identify the non-base layers. Anything that isn't the under terrain is
  // structure / decoration — that's what we want to capture for stamps.
  const structureLayers = parsed.layers.filter((l) => l.name !== 'under')
  for (const region of STAMP_REGIONS) {
    const cells: SparseStampCell[] = []
    for (const layer of structureLayers) {
      for (let dy = 0; dy < region.h; dy++) {
        for (let dx = 0; dx < region.w; dx++) {
          const sx = region.x + dx
          const sy = region.y + dy
          if (sx < 0 || sx >= parsed.width || sy < 0 || sy >= parsed.height) continue
          const gid = layer.tiles[sy * parsed.width + sx]
          if (gid === 0) continue
          cells.push({ dx, dy, gid })
        }
      }
    }
    out.set(region.name, { name: region.name, width: region.w, height: region.h, cells })
  }
  cachedStamps = out
  return out
}
