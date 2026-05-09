// 4-corner Wang autotile lookup, sourced from Pita's terrain definitions.
// Terrain ids: 1 = grass, 4 = cliff (mountain), 5 = water, 6 = beach.
// Each key is "TL,TR,BL,BR" terrain codes; value is the tile filename
// (matching scripts/slice-pita-autotile.ts output).

export type Terrain = 1 | 4 | 5 | 6

export const AUTOTILE: Record<string, string> = {
  // ===== (1, 5) grass ↔ water =====
  '1,1,1,1': 't1',
  '1,1,1,5': 't420',
  '1,1,5,1': 't422',
  '1,5,1,1': 't500',
  '5,1,1,1': 't502',
  '1,1,5,5': 't421',
  '1,5,1,5': 't460',
  '1,5,5,1': 't503',
  '5,1,1,5': 't504',
  '5,1,5,1': 't462',
  '5,5,1,1': 't501',
  '1,5,5,5': 't423',
  '5,1,5,5': 't424',
  '5,5,1,5': 't463',
  '5,5,5,1': 't464',
  '5,5,5,5': 't461',
  // ===== (5, 6) beach ↔ water =====
  '6,6,6,6': 't681',
  '6,6,6,5': 't660',
  '6,6,5,6': 't662',
  '6,5,6,6': 't740',
  '5,6,6,6': 't742',
  '6,6,5,5': 't661',
  '6,5,6,5': 't700',
  '5,6,6,5': 't744',
  '6,5,5,6': 't743',
  '5,6,5,6': 't702',
  '5,5,6,6': 't741',
  '6,5,5,5': 't663',
  '5,6,5,5': 't664',
  '5,5,6,5': 't703',
  '5,5,5,6': 't704',
  // ===== (1, 5, 6) tri-corner =====
  '5,5,1,6': 't340',
  '5,5,6,1': 't341',
  '5,1,5,6': 't342',
  '1,5,6,5': 't343',
  '1,6,5,5': 't380',
  '6,1,5,5': 't381',
  '5,6,5,1': 't382',
  '6,5,1,5': 't383',
  // ===== (1, 4) grass ↔ cliff =====
  '4,4,4,4': 't441',
  '1,1,1,4': 't400',
  '1,1,4,1': 't402',
  '1,4,1,1': 't480',
  '4,1,1,1': 't482',
  '1,1,4,4': 't401',
  '1,4,1,4': 't440',
  '1,4,4,1': 't483',
  '4,1,1,4': 't484',
  '4,1,4,1': 't442',
  '4,4,1,1': 't481',
  '1,4,4,4': 't403',
  '4,1,4,4': 't404',
  '4,4,1,4': 't443',
  '4,4,4,1': 't444',
  // ===== (4, 6) beach ↔ cliff =====
  '6,6,6,4': 't520',
  '6,6,4,6': 't522',
  '6,4,6,6': 't600',
  '4,6,6,6': 't602',
  '6,6,4,4': 't521',
  '6,4,6,4': 't560',
  '6,4,4,6': 't603',
  '4,6,6,4': 't604',
  '4,6,4,6': 't562',
  '4,4,6,6': 't601',
  '6,4,4,4': 't523',
  '4,6,4,4': 't524',
  '4,4,6,4': 't563',
  '4,4,4,6': 't564',
  // ===== (4, 5) cliff ↔ water =====
  '4,4,4,5': 't540',
  '4,4,5,4': 't542',
  '4,5,4,4': 't620',
  '5,4,4,4': 't622',
  '4,4,5,5': 't541',
  '4,5,4,5': 't580',
  '4,5,5,4': 't623',
  '5,4,4,5': 't624',
  '5,4,5,4': 't582',
  '5,5,4,4': 't621',
  '4,5,5,5': 't543',
  '5,4,5,5': 't544',
  '5,5,4,5': 't583',
  '5,5,5,4': 't584',
}

/**
 * Look up the tile id for a given 4-corner terrain pattern. Returns null if
 * the combination isn't in the lookup (caller should fall back to a base
 * tile of one of the corner terrains).
 */
export function autotileFor(tl: Terrain, tr: Terrain, bl: Terrain, br: Terrain): string | null {
  return AUTOTILE[`${tl},${tr},${bl},${br}`] ?? null
}

/** Sentinel — animated water uses the SVG pattern, not a static tile. */
export const ANIMATED_WATER_PATTERN_ID = 'tex-ocean-anim'
