// Big slice: every tile we need for the new TileMap renderer.
//
// Includes per-biome variety pools, beach-water 4-corner transitions, tree
// variants, settlement tiles, and the deep-ocean animation cycle. All output
// at 64×64 PNG (16×16 source × 4 nearest-neighbor scale) so they stay crisp.

import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const TILESET = 'public/textures/_pita/Overworld_Tileset.png'
const OUT = 'public/textures/tiles'
const COLS = 40
const TILE = 16
const SCALE = 4
mkdirSync(OUT, { recursive: true })

function slice(name: string, id: number) {
  const x = (id % COLS) * TILE
  const y = Math.floor(id / COLS) * TILE
  const tmp = `${OUT}/__t.png`
  execSync(
    `npx --yes sharp-cli --input "${TILESET}" --output "${tmp}" extract ${y} ${x} ${TILE} ${TILE}`,
    { shell: 'bash' },
  )
  execSync(
    `npx --yes sharp-cli --input "${tmp}" --output "${OUT}/${name}.png" resize ${TILE * SCALE} ${TILE * SCALE} --kernel nearest`,
    { shell: 'bash' },
  )
  execSync(`rm -f "${tmp}"`, { shell: 'bash' })
}

const PLANS: [string, number][] = [
  // Plains — regular grass (3 variants) + light grass (5 variants).
  ['plains_0', 1],
  ['plains_1', 45],
  ['plains_2', 81],
  ['plains_3', 85],
  ['plains_4', 86],
  // Hills — only 1 pure tile in the pack, plus a couple varied surrounds.
  ['hills_0', 201],
  ['hills_1', 161],
  ['hills_2', 162],
  // Mountain (cliffs) — 2 pure tiles + a third lookalike.
  ['mountain_0', 441],
  ['mountain_1', 561],
  ['mountain_2', 481],
  // Coast (beach) — 1 pure tile in pack.
  ['coast_0', 681],
  // Ocean — multiple depth variants (deep + regular under-layer).
  ['ocean_under_0', 801],
  ['ocean_shallow_0', 821],
  ['ocean_deep_0', 896],
  // Tree variants for forest scatter.
  ['tree_0', 285],
  ['tree_1', 321],
  ['tree_2', 325],
  ['tree_3', 281],
  ['tree_4', 282],
  // Settlement / building sprites — scanned from the architectural rows.
  ['house_0', 367],
  ['house_1', 368],
  ['house_2', 369],
  ['castle_wall_top', 369], // placeholder, may swap
  // Mountain rock decoration on hills.
  ['rock_0', 482],
  ['rock_1', 483],
  // Ocean animation cycle — already extracted, re-asserted for clarity.
  ['ocean_a0', 900],
  ['ocean_a1', 904],
  ['ocean_a2', 908],
  ['ocean_a3', 912],
  // Beach autotile transitions: each has a different combo of land/water
  // corners. Ids harvested from Pita's terrain="6,9,...,..." patterns.
  ['beach_n', 642], // water above
  ['beach_s', 762], // water below
  ['beach_w', 681], // placeholder
  ['beach_e', 681], // placeholder
  ['beach_ne', 643],
  ['beach_nw', 641],
  ['beach_se', 763],
  ['beach_sw', 761],
]

for (const [name, id] of PLANS) {
  slice(name, id)
  console.log(`  ${name.padEnd(18)} id=${id}`)
}

console.log(`\nSliced ${PLANS.length} tiles into ${OUT}/`)
