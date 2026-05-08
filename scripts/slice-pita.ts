// Slice individual base biome tiles out of Pita's RPG Overworld Tileset and
// save each as a scaled PNG suitable for hex fills. Pixel-art is scaled with
// nearest-neighbor so it stays crisp.
//
// Tile IDs come from Extras/OverworldTileset.tsx terrain definitions plus a
// few hand-picked ones for biomes the tsx doesn't label (desert, swamp,
// tundra). All biomes use a single representative "fully surrounded" tile.

import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const TILESET = 'public/textures/_pita/Overworld_Tileset.png'
const OUT_DIR = 'public/textures/tiles'
mkdirSync(OUT_DIR, { recursive: true })

const TILE = 16
const COLS = 40
const SCALE = 4 // 16×16 → 64×64

interface Pick {
  biome: string
  /** tile id (row * 40 + col) */
  id: number
}

// Picks chosen by reading the tsx + eyeballing the tileset preview.
const PICKS: Pick[] = [
  { biome: 'plains', id: 1 }, // regular grass
  { biome: 'forest', id: 282 }, // dense canopy in the woodland row
  { biome: 'hills', id: 162 }, // light hill mound
  { biome: 'mountain', id: 481 }, // cliff base
  { biome: 'coast', id: 681 }, // beach
  { biome: 'desert', id: 1010 }, // sun-bleached sand (lower-right of tileset)
  { biome: 'swamp', id: 446 }, // dark mossy patch
  { biome: 'tundra', id: 25 }, // snow/ice top-right of the visible block
  { biome: 'ocean', id: 896 }, // deep ocean
]

for (const p of PICKS) {
  const col = p.id % COLS
  const row = Math.floor(p.id / COLS)
  const x = col * TILE
  const y = row * TILE
  const tmp = `${OUT_DIR}/__tile_${p.biome}.png`
  const out = `${OUT_DIR}/${p.biome}.png`
  execSync(
    `npx --yes sharp-cli --input "${TILESET}" --output "${tmp}" extract ${y} ${x} ${TILE} ${TILE}`,
    { stdio: 'inherit', shell: 'bash' },
  )
  execSync(
    `npx --yes sharp-cli --input "${tmp}" --output "${out}" resize ${TILE * SCALE} ${TILE * SCALE} --kernel nearest`,
    { stdio: 'inherit', shell: 'bash' },
  )
  execSync(`rm -f "${tmp}"`, { stdio: 'inherit', shell: 'bash' })
  console.log(`  ${p.biome.padEnd(10)} id=${p.id} (${col},${row}) → ${out}`)
}

console.log('\nDone. Update HexMap to point at the .png biome textures.')
