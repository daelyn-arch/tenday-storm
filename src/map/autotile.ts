// 4-corner Wang autotile lookup, sourced from Pita's TSX terrain definitions.
// Terrain ids: 1 = grass, 4 = cliff (mountain), 5 = water, 6 = beach.
// Key is "TL,TR,BL,BR" terrain codes; value is the source-tile gid in the
// Overworld tileset (1-indexed, matching Tiled's TMX gids).

export type Terrain = 1 | 4 | 5 | 6

// Tile id → gid is id+1 because Tiled gids are 1-indexed.
function g(id: number): number {
  return id + 1
}

export const AUTOTILE: Record<string, number> = {
  // (1, 5) grass ↔ water
  '1,1,1,1': g(1),
  '1,1,1,5': g(420),
  '1,1,5,1': g(422),
  '1,5,1,1': g(500),
  '5,1,1,1': g(502),
  '1,1,5,5': g(421),
  '1,5,1,5': g(460),
  '1,5,5,1': g(503),
  '5,1,1,5': g(504),
  '5,1,5,1': g(462),
  '5,5,1,1': g(501),
  '1,5,5,5': g(423),
  '5,1,5,5': g(424),
  '5,5,1,5': g(463),
  '5,5,5,1': g(464),
  '5,5,5,5': g(461),
  // (5, 6) beach ↔ water
  '6,6,6,6': g(681),
  '6,6,6,5': g(660),
  '6,6,5,6': g(662),
  '6,5,6,6': g(740),
  '5,6,6,6': g(742),
  '6,6,5,5': g(661),
  '6,5,6,5': g(700),
  '5,6,6,5': g(744),
  '6,5,5,6': g(743),
  '5,6,5,6': g(702),
  '5,5,6,6': g(741),
  '6,5,5,5': g(663),
  '5,6,5,5': g(664),
  '5,5,6,5': g(703),
  '5,5,5,6': g(704),
  // (1, 5, 6) tri-corner
  '5,5,1,6': g(340),
  '5,5,6,1': g(341),
  '5,1,5,6': g(342),
  '1,5,6,5': g(343),
  '1,6,5,5': g(380),
  '6,1,5,5': g(381),
  '5,6,5,1': g(382),
  '6,5,1,5': g(383),
  // (1, 4) grass ↔ cliff
  '4,4,4,4': g(441),
  '1,1,1,4': g(400),
  '1,1,4,1': g(402),
  '1,4,1,1': g(480),
  '4,1,1,1': g(482),
  '1,1,4,4': g(401),
  '1,4,1,4': g(440),
  '1,4,4,1': g(483),
  '4,1,1,4': g(484),
  '4,1,4,1': g(442),
  '4,4,1,1': g(481),
  '1,4,4,4': g(403),
  '4,1,4,4': g(404),
  '4,4,1,4': g(443),
  '4,4,4,1': g(444),
  // (4, 6) beach ↔ cliff
  '6,6,6,4': g(520),
  '6,6,4,6': g(522),
  '6,4,6,6': g(600),
  '4,6,6,6': g(602),
  '6,6,4,4': g(521),
  '6,4,6,4': g(560),
  '6,4,4,6': g(603),
  '4,6,6,4': g(604),
  '4,6,4,6': g(562),
  '4,4,6,6': g(601),
  '6,4,4,4': g(523),
  '4,6,4,4': g(524),
  '4,4,6,4': g(563),
  '4,4,4,6': g(564),
  // (4, 5) cliff ↔ water
  '4,4,4,5': g(540),
  '4,4,5,4': g(542),
  '4,5,4,4': g(620),
  '5,4,4,4': g(622),
  '4,4,5,5': g(541),
  '4,5,4,5': g(580),
  '4,5,5,4': g(623),
  '5,4,4,5': g(624),
  '5,4,5,4': g(582),
  '5,5,4,4': g(621),
  '4,5,5,5': g(543),
  '5,4,5,5': g(544),
  '5,5,4,5': g(583),
  '5,5,5,4': g(584),
}

export function autotileFor(tl: Terrain, tr: Terrain, bl: Terrain, br: Terrain): number | null {
  return AUTOTILE[`${tl},${tr},${bl},${br}`] ?? null
}

// Forest tree-cluster gids (terrain 0 in Pita TSX). Used as decoration
// overlay on grass cells flagged as forest.
export const FOREST_INTERIOR_GIDS = [g(285), g(321), g(325)]
export const FOREST_EDGE_GIDS = [
  g(280), g(281), g(282), g(283), g(284),
  g(320), g(322), g(323), g(324),
  g(360), g(361), g(362), g(363), g(364),
]

// Depth-graded ocean base tiles (used when a cell is fully water).
export const OCEAN_SHALLOW_GID = g(821)
export const OCEAN_REGULAR_GID = g(801)
export const OCEAN_DEEP_GID = g(896)
