// Grid coordinates. The {q, r} naming is a vestige of the hex era — q is now
// x (column) and r is y (row). Names kept so the rest of the codebase (and
// the Supabase columns) don't need to be touched all at once.

export interface Axial {
  q: number // x / column
  r: number // y / row
}

/** Pixel size of one cell in the SVG/render coordinate system. */
export const TILE_SIZE = 64
/** Back-compat alias — old hex code referenced HEX_SIZE. */
export const HEX_SIZE = TILE_SIZE

// 4-directional orthogonal neighbors. Order: E, S, W, N.
export const NEIGHBORS: Axial[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
]

export function neighbors(a: Axial): Axial[] {
  return NEIGHBORS.map((n) => ({ q: a.q + n.q, r: a.r + n.r }))
}

export function axialEqual(a: Axial, b: Axial): boolean {
  return a.q === b.q && a.r === b.r
}

export function axialKey(a: Axial): string {
  return `${a.q},${a.r}`
}

/**
 * Chebyshev distance — king's-move metric. Feels right for grid hexcrawl
 * mechanics: a storm of radius 3 covers a 7×7 block centred on the storm cell.
 */
export function axialDistance(a: Axial, b: Axial): number {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r))
}

export function rectHexes(width: number, height: number): Axial[] {
  const out: Axial[] = []
  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      out.push({ q, r })
    }
  }
  return out
}

export function rectCenter(width: number, height: number): Axial {
  return { q: Math.floor(width / 2), r: Math.floor(height / 2) }
}

/** Top-left pixel of cell (q, r) in user space. */
export function hexToPixel(a: Axial, size: number = TILE_SIZE): { x: number; y: number } {
  return { x: a.q * size, y: a.r * size }
}

/** Centre pixel of cell (q, r). */
export function cellCenter(a: Axial, size: number = TILE_SIZE): { x: number; y: number } {
  return { x: a.q * size + size / 2, y: a.r * size + size / 2 }
}

export function rectBounds(width: number, height: number, size: number = TILE_SIZE) {
  const w = width * size
  const h = height * size
  return { minX: 0, minY: 0, maxX: w, maxY: h, w, h }
}

/** Vestigial — square corners for callers that still ask for "hex" corners. */
export function hexCorners(cx: number, cy: number, size: number = TILE_SIZE) {
  const half = size / 2
  return [
    { x: cx - half, y: cy - half },
    { x: cx + half, y: cy - half },
    { x: cx + half, y: cy + half },
    { x: cx - half, y: cy + half },
  ]
}

export function hexPolygonPoints(cx: number, cy: number, size: number = TILE_SIZE): string {
  const half = size / 2
  return `${cx - half},${cy - half} ${cx + half},${cy - half} ${cx + half},${cy + half} ${cx - half},${cy + half}`
}
