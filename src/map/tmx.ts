// Minimal Pita-TMX renderer. Parses a Tiled .tmx file (XML with CSV-encoded
// tile data per layer), composites every layer onto a canvas using the
// Overworld + TropicalExtras sprite atlases directly. Output is a PNG data
// URL the same shape as our procedural baker, so the rest of the renderer
// pipeline doesn't have to care which source produced the image.

const TILE = 16
const OVERWORLD_COLS = 40

interface TmxLayer {
  name: string
  tiles: number[] // tile gids, 0 = empty
}

interface TmxMap {
  width: number
  height: number
  layers: TmxLayer[]
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`)
  return r.text()
}

function parseTmx(xml: string): TmxMap {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const map = doc.querySelector('map')
  if (!map) throw new Error('TMX has no <map>')
  const width = parseInt(map.getAttribute('width') ?? '0', 10)
  const height = parseInt(map.getAttribute('height') ?? '0', 10)
  const layers: TmxLayer[] = []
  for (const layer of Array.from(doc.querySelectorAll('layer'))) {
    const name = layer.getAttribute('name') ?? ''
    const data = layer.querySelector('data')
    if (!data) continue
    const text = data.textContent ?? ''
    const tiles = text
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => parseInt(s, 10) || 0)
    layers.push({ name, tiles })
  }
  return { width, height, layers }
}

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
  const xml = await fetchText(tmxUrl)
  const map = parseTmx(xml)
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
  const xml = await fetchText(tmxUrl)
  const map = parseTmx(xml)
  return { width: map.width, height: map.height }
}
