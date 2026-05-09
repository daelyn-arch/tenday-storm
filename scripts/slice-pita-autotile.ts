// Slice every tile we need for the autotile shoreline system.
// terrain ids: 1=grass, 5=water-upper, 6=beach.
// Each tile is named t<id>.png so the lookup table can reference it directly.

import { execSync } from 'node:child_process'

const TILESET = 'public/textures/_pita/Overworld_Tileset.png'
const OUT = 'public/textures/tiles'
const COLS = 40
const TILE = 16
const SCALE = 4

function slice(id: number) {
  const x = (id % COLS) * TILE
  const y = Math.floor(id / COLS) * TILE
  const tmp = `${OUT}/__t.png`
  execSync(
    `npx --yes sharp-cli --input "${TILESET}" --output "${tmp}" extract ${y} ${x} ${TILE} ${TILE}`,
    { shell: 'bash' },
  )
  execSync(
    `npx --yes sharp-cli --input "${tmp}" --output "${OUT}/t${id}.png" resize ${TILE * SCALE} ${TILE * SCALE} --kernel nearest`,
    { shell: 'bash' },
  )
  execSync(`rm -f "${tmp}"`, { shell: 'bash' })
}

const IDS = [
  // (1,5) grass-water — 16 combos
  0, 1, 2, 420, 421, 422, 423, 424, 460, 461, 462, 463, 464, 500, 501, 502, 503, 504,
  // (5,6) beach-water — 16 combos
  660, 661, 662, 663, 664, 681, 700, 701, 702, 703, 704, 740, 741, 742, 743, 744,
  // (1,5,6) tri-corner — 8 combos
  340, 341, 342, 343, 380, 381, 382, 383,
  // (1,4) grass-cliff — 16 combos
  400, 401, 402, 403, 404, 440, 441, 442, 443, 444, 480, 481, 482, 483, 484,
  // (4,6) beach-cliff — 16 combos
  520, 521, 522, 523, 524, 560, 561, 562, 563, 564, 600, 601, 602, 603, 604,
  // (4,5) cliff-water — 16 combos
  540, 541, 542, 543, 544, 580, 581, 582, 583, 584, 620, 621, 622, 623, 624,
]

for (const id of IDS) {
  slice(id)
  console.log(`  t${id}.png`)
}
console.log(`Sliced ${IDS.length} transition tiles.`)
