// Phase-2 slice: animation frames + decorative sprites from Pita's tileset.

import { execSync } from 'node:child_process'

const TILESET = 'public/textures/_pita/Overworld_Tileset.png'
const OUT = 'public/textures/tiles'
const COLS = 40
const TILE = 16
const SCALE = 4

function slice(name: string, id: number) {
  const x = (id % COLS) * TILE
  const y = Math.floor(id / COLS) * TILE
  const tmp = `${OUT}/__t.png`
  execSync(
    `npx --yes sharp-cli --input "${TILESET}" --output "${tmp}" extract ${y} ${x} ${TILE} ${TILE}`,
    { stdio: 'inherit', shell: 'bash' },
  )
  execSync(
    `npx --yes sharp-cli --input "${tmp}" --output "${OUT}/${name}.png" resize ${TILE * SCALE} ${TILE * SCALE} --kernel nearest`,
    { stdio: 'inherit', shell: 'bash' },
  )
  execSync(`rm -f "${tmp}"`, { shell: 'bash' })
  console.log(`  ${name.padEnd(14)} id=${id} → ${OUT}/${name}.png`)
}

// Ocean animation frames — deep-ocean wave cycle: 900, 904, 908, 912.
slice('ocean_0', 900)
slice('ocean_1', 904)
slice('ocean_2', 908)
slice('ocean_3', 912)

// Tree sprite — pulled from the woodland row. Tile 286 is the terrain tag;
// 280-285 are dense canopy tiles. Pick one as the "tree decor" sprite.
slice('decor_tree', 281)

// Mountain rock sprite for scattering on hill/mountain hexes.
slice('decor_rock', 482)

// Building sprite for settlements (small house tile).
slice('decor_house', 367)
