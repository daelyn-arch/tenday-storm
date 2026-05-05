// Axial hex coordinates with pointy-top orientation.
// q = column (skewed), r = row.

export interface Axial {
  q: number
  r: number
}

export const HEX_SIZE = 28 // pixel radius for default render

// Axial neighbor offsets (pointy-top), ordered to match the 6 polygon edges
// produced by hexPolygonPoints: [E, SE, SW, W, NW, NE]. Edge i lies on the
// segment between polygon corner i and corner (i+1) % 6 and faces NEIGHBORS[i].
export const NEIGHBORS: Axial[] = [
  { q: 1, r: 0 },   // 0 E
  { q: 0, r: 1 },   // 1 SE
  { q: -1, r: 1 },  // 2 SW
  { q: -1, r: 0 },  // 3 W
  { q: 0, r: -1 },  // 4 NW
  { q: 1, r: -1 },  // 5 NE
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

// Convert axial → cube to compute distance.
export function axialDistance(a: Axial, b: Axial): number {
  const ax = a.q
  const az = a.r
  const ay = -ax - az
  const bx = b.q
  const bz = b.r
  const by = -bx - bz
  return (Math.abs(ax - bx) + Math.abs(ay - by) + Math.abs(az - bz)) / 2
}

// Rectangular axial layout: for height H and width W, store (q, r) such that
// each row r ∈ [0, H), each col q ∈ [-floor(r/2), W - floor(r/2)).
// This keeps a clean rectangular bounding box.
export function rectHexes(width: number, height: number): Axial[] {
  const out: Axial[] = []
  for (let r = 0; r < height; r++) {
    const offset = -Math.floor(r / 2)
    for (let qi = 0; qi < width; qi++) {
      out.push({ q: qi + offset, r })
    }
  }
  return out
}

// Centermost hex of a rectangular layout.
export function rectCenter(width: number, height: number): Axial {
  const r = Math.floor(height / 2)
  const offset = -Math.floor(r / 2)
  return { q: Math.floor(width / 2) + offset, r }
}

// Pixel position for a hex (pointy-top), top-left origin.
export function hexToPixel(a: Axial, size: number = HEX_SIZE): { x: number; y: number } {
  const x = size * Math.sqrt(3) * (a.q + a.r / 2)
  const y = size * (3 / 2) * a.r
  return { x, y }
}

// Inclusive bounding box (in pixel coords) of a rectangular hex layout.
export function rectBounds(width: number, height: number, size: number = HEX_SIZE) {
  const corners = [
    hexToPixel({ q: 0, r: 0 }, size),
    hexToPixel({ q: width - 1, r: 0 }, size),
    hexToPixel({ q: -Math.floor((height - 1) / 2), r: height - 1 }, size),
    hexToPixel({ q: width - 1 - Math.floor((height - 1) / 2), r: height - 1 }, size),
  ]
  const xs = corners.map((c) => c.x)
  const ys = corners.map((c) => c.y)
  const minX = Math.min(...xs) - size * Math.sqrt(3) / 2
  const maxX = Math.max(...xs) + size * Math.sqrt(3) / 2
  const minY = Math.min(...ys) - size
  const maxY = Math.max(...ys) + size
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY }
}

// SVG polygon points for a pointy-top hex centered at (cx, cy).
// Corners (in SVG y-down coords): 0=upper-right, 1=lower-right, 2=bottom,
// 3=lower-left, 4=upper-left, 5=top.
export function hexCorners(cx: number, cy: number, size: number = HEX_SIZE): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    out.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) })
  }
  return out
}

export function hexPolygonPoints(cx: number, cy: number, size: number = HEX_SIZE): string {
  return hexCorners(cx, cy, size)
    .map((p) => `${p.x},${p.y}`)
    .join(' ')
}
