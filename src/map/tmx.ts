// Render a Pita .tmx to a PNG data URL by compositing every layer onto a
// canvas via the Overworld + TropicalExtras sprite atlases. Same shape of
// output as our procedural baker; renderer pipeline doesn't need to care.

import { parseTmx } from './tmx-parse'

const TILE = 16
const OVERWORLD_COLS = 40

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

/**
 * Render a TMX to a PNG data URL. Looks up every tile gid in either the
 * Overworld atlas (gids 1..1520) or the TropicalExtras atlas (gids ≥ 1521).
 */
export async function renderTmx(tmxUrl: string, base: string): Promise<string> {
  const map = await parseTmx(tmxUrl)
  const [overworld, tropical] = await Promise.all([
    loadImage(`${base}textures/_pita/Overworld_Tileset.png`),
    loadImage(`${base}textures/_pita/TropicalExtras_Tileset.png`),
  ])
  const canvas = document.createElement('canvas')
  canvas.width = map.width * TILE
  canvas.height = map.height * TILE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas context unavailable')
  ctx.imageSmoothingEnabled = false

  for (const layer of map.layers) {
    for (let i = 0; i < layer.tiles.length; i++) {
      const gid = layer.tiles[i]
      if (gid === 0) continue
      // Overworld: gids 1..1520 (40 cols × 38 rows = 1520)
      // TropicalExtras: gids 1521..1584 (8 cols × 8 rows = 64)
      let atlas: HTMLImageElement
      let tileId: number
      let cols: number
      if (gid <= 1520) {
        atlas = overworld
        tileId = gid - 1
        cols = OVERWORLD_COLS
      } else {
        atlas = tropical
        tileId = gid - 1521
        cols = 8
      }
      const srcX = (tileId % cols) * TILE
      const srcY = Math.floor(tileId / cols) * TILE
      const dx = (i % map.width) * TILE
      const dy = Math.floor(i / map.width) * TILE
      ctx.drawImage(atlas, srcX, srcY, TILE, TILE, dx, dy, TILE, TILE)
    }
  }
  return canvas.toDataURL('image/png')
}

export async function loadTmxMeta(tmxUrl: string): Promise<{ width: number; height: number }> {
  const map = await parseTmx(tmxUrl)
  return { width: map.width, height: map.height }
}
