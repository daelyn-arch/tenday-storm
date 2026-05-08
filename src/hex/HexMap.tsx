import { useEffect, useMemo, useRef, useState } from 'react'
import {
  axialDistance,
  axialKey,
  cellCenter,
  hexToPixel,
  rectBounds,
  type Axial,
} from './coords'
import { BIOME_LABEL } from '../world/biomes'
import type { Biome, HexRow, RegionRow } from '../types/db'
import { LocationIcon } from './LocationIcon'

export interface MapHex
  extends Pick<HexRow, 'q' | 'r' | 'biome' | 'region_id' | 'revealed' | 'party_visited' | 'generated' | 'dm_notes' | 'location_type'> {}

export type PinKind = 'quest' | 'rumor' | 'encounter' | 'journal'

export interface Pin {
  q: number
  r: number
  kind: PinKind
}

export interface HexMapProps {
  width: number
  height: number
  hexes: MapHex[]
  regions: RegionRow[]
  partyHex: Axial
  stormHex: Axial
  stormRadius: number
  nextStormHex?: Axial | null
  finalBoss?: Axial | null
  pins?: Pin[]
  selected?: Axial | null
  onSelect?: (next: Axial | null) => void
  mode: 'dm' | 'player'
}

const PIN_COLORS: Record<PinKind, string> = {
  quest: '#ffd84a',
  rumor: '#e84a4a',
  encounter: '#ff9a3a',
  journal: '#5cc7ff',
}

// Each game cell is now a 4×4 grid of Pita tiles, displayed at 2× source
// scale (so each tile is 32px on screen, each cell 128px). This finally
// lets the maps look like Pita's reference shots: real terrain density
// instead of one stretched tile per cell.
const CELL_SIZE = 128
const SUB = 4
const SUB_SIZE = CELL_SIZE / SUB // 32

// Tile pools per biome. Order matters — first entry is the dominant tile,
// rest are variants sprinkled in by the weighted picker.
const BIOME_POOL: Record<Biome, string[]> = {
  ocean: ['ocean_a0'], // sentinel — actually drawn via animated <pattern>
  coast: ['coast_0'],
  plains: ['plains_0', 'plains_1', 'plains_2', 'plains_3', 'plains_4'],
  forest: ['plains_0', 'plains_1', 'plains_2'], // grass base, trees overlaid
  hills: ['hills_0', 'hills_1', 'hills_2'],
  mountain: ['mountain_0', 'mountain_1', 'mountain_2'],
  desert: ['desert'],
  swamp: ['swamp'],
  tundra: ['tundra'],
}

// Roughly how often each entry shows up. Front-loaded so most of a biome
// reads as one consistent texture with the variants as visual interest.
const BIOME_WEIGHTS: Partial<Record<Biome, number[]>> = {
  plains: [0.6, 0.15, 0.13, 0.07, 0.05],
  forest: [0.5, 0.3, 0.2],
  hills: [0.6, 0.25, 0.15],
  mountain: [0.55, 0.25, 0.2],
}

const TREE_VARIANTS = ['tree_0', 'tree_1', 'tree_2', 'tree_3', 'tree_4']
const ROCK_VARIANTS = ['rock_0', 'rock_1']

// Autotile lookup. Keys are "TL,TR,BL,BR" terrain codes:
// 1 = grass (any non-coast non-ocean land), 5 = water, 6 = beach.
// Values are tile filenames (matching scripts/slice-pita-autotile.ts output).
const AUTOTILE: Record<string, string> = {
  // (1,5) grass-water
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
  // (5,6) beach-water
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
  '6,6,6,6': 't681',
  // (1,5,6) tri-corner
  '5,5,1,6': 't340',
  '5,5,6,1': 't341',
  '5,1,5,6': 't342',
  '1,5,6,5': 't343',
  '1,6,5,5': 't380',
  '6,1,5,5': 't381',
  '5,6,5,1': 't382',
  '6,5,1,5': 't383',
}

type CornerColor = 'water' | 'beach' | 'grass'

function cornerTerrainCode(c: CornerColor): number {
  return c === 'water' ? 5 : c === 'beach' ? 6 : 1
}

function cellHash(q: number, r: number, salt: number): number {
  let h = (q * 73856093) ^ (r * 19349663) ^ (salt * 83492791)
  h = (h ^ (h >>> 16)) * 0x85ebca6b
  h = (h ^ (h >>> 13)) * 0xc2b2ae35
  h = h ^ (h >>> 16)
  return h >>> 0
}

function pickTileVariant(biome: Biome, q: number, r: number, sx: number, sy: number): string {
  const seed = cellHash(q, r, sx + sy * SUB + 1)
  const pool = BIOME_POOL[biome] ?? ['plains_0']
  if (pool.length === 1) return pool[0]
  const weights = BIOME_WEIGHTS[biome] ?? new Array(pool.length).fill(1 / pool.length)
  const r01 = (seed & 0xffff) / 0x10000
  let acc = 0
  for (let i = 0; i < pool.length; i++) {
    acc += weights[i] ?? 0
    if (r01 < acc) return pool[i]
  }
  return pool[pool.length - 1]
}

interface FogState {
  vis: Map<string, 'revealed' | 'scouted' | 'unknown'>
  knownRegions: Set<string>
}

function computeFog(props: HexMapProps): FogState {
  const vis = new Map<string, 'revealed' | 'scouted' | 'unknown'>()
  const knownRegions = new Set<string>()
  if (props.mode === 'dm') {
    for (const h of props.hexes) {
      vis.set(axialKey(h), 'revealed')
      if (h.region_id) knownRegions.add(h.region_id)
    }
    return { vis, knownRegions }
  }
  for (const h of props.hexes) {
    if (h.revealed) {
      vis.set(axialKey(h), 'revealed')
      if (h.region_id) knownRegions.add(h.region_id)
    } else {
      const d = axialDistance({ q: h.q, r: h.r }, props.partyHex)
      if (d <= 1) vis.set(axialKey(h), 'scouted')
      else vis.set(axialKey(h), 'unknown')
    }
  }
  return { vis, knownRegions }
}

export function HexMap(props: HexMapProps) {
  const { hexes, regions, partyHex, stormHex, stormRadius, nextStormHex, finalBoss, pins, selected, onSelect, mode } = props
  const fog = useMemo(() => computeFog(props), [props])
  const regionsById = useMemo(() => {
    const m = new Map<string, RegionRow>()
    regions.forEach((r) => m.set(r.id, r))
    return m
  }, [regions])
  const hexesByKey = useMemo(() => {
    const m = new Map<string, MapHex>()
    hexes.forEach((h) => m.set(axialKey(h), h))
    return m
  }, [hexes])
  const bounds = useMemo(() => rectBounds(props.width, props.height, CELL_SIZE), [props.width, props.height])
  const base = import.meta.env.BASE_URL
  const tile = (name: string) => `${base}textures/tiles/${name}.png`

  // Pan/zoom
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [scale, setScale] = useState(1)
  const dragging = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const cw = c.clientWidth
    const ch = c.clientHeight
    const sx = cw / bounds.w
    const sy = ch / bounds.h
    const s = Math.min(sx, sy) * 0.95
    setScale(s)
    setTx((cw - bounds.w * s) / 2 - bounds.minX * s)
    setTy((ch - bounds.h * s) / 2 - bounds.minY * s)
  }, [bounds.w, bounds.h, bounds.minX, bounds.minY])

  // Region outlines
  const regionEdges = useMemo(() => {
    const segs: { x1: number; y1: number; x2: number; y2: number; color: string }[] = []
    for (const h of hexes) {
      if (!h.region_id) continue
      if (mode === 'player' && !fog.knownRegions.has(h.region_id)) continue
      const region = regionsById.get(h.region_id)
      if (!region) continue
      const color = region.color
      const left = h.q * CELL_SIZE
      const top = h.r * CELL_SIZE
      const right = left + CELL_SIZE
      const bottom = top + CELL_SIZE
      const sides: [Axial, [number, number, number, number]][] = [
        [{ q: h.q + 1, r: h.r }, [right, top, right, bottom]],
        [{ q: h.q - 1, r: h.r }, [left, top, left, bottom]],
        [{ q: h.q, r: h.r + 1 }, [left, bottom, right, bottom]],
        [{ q: h.q, r: h.r - 1 }, [left, top, right, top]],
      ]
      for (const [n, [x1, y1, x2, y2]] of sides) {
        const nh = hexesByKey.get(axialKey(n))
        if (nh && nh.region_id === h.region_id) continue
        segs.push({ x1, y1, x2, y2, color })
      }
    }
    return segs
  }, [hexes, hexesByKey, regionsById, fog.knownRegions, mode])

  const regionLabels = useMemo(() => {
    const acc = new Map<string, { x: number; y: number; n: number; name: string; color: string }>()
    for (const h of hexes) {
      if (!h.region_id) continue
      const region = regionsById.get(h.region_id)
      if (!region) continue
      const c = cellCenter({ q: h.q, r: h.r }, CELL_SIZE)
      const cur = acc.get(h.region_id) ?? { x: 0, y: 0, n: 0, name: region.name, color: region.color }
      cur.x += c.x
      cur.y += c.y
      cur.n += 1
      acc.set(h.region_id, cur)
    }
    return Array.from(acc.values()).map((v) => ({
      x: v.x / v.n,
      y: v.y / v.n,
      name: v.name,
      color: v.color,
    }))
  }, [hexes, regionsById])

  const pinsByHex = useMemo(() => {
    const m = new Map<string, PinKind[]>()
    for (const p of pins ?? []) {
      const k = `${p.q},${p.r}`
      const arr = m.get(k) ?? []
      arr.push(p.kind)
      m.set(k, arr)
    }
    return m
  }, [pins])

  const stormCenter = cellCenter(stormHex, CELL_SIZE)
  const stormPixelRadius = CELL_SIZE * (stormRadius + 0.5)
  const nextStormCenter = nextStormHex ? cellCenter(nextStormHex, CELL_SIZE) : null
  const partyCenter = cellCenter(partyHex, CELL_SIZE)
  const finalBossCenter = finalBoss ? cellCenter(finalBoss, CELL_SIZE) : null

  const selectedHex = selected ? hexesByKey.get(`${selected.q},${selected.r}`) : null
  const hudLabel = selectedHex
    ? `${BIOME_LABEL[selectedHex.biome]} (${selected!.q}, ${selected!.r})`
    : null

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#1a3550] select-none"
      onMouseDown={(e) => {
        if (e.button !== 0) return
        const isBg = (e.target as Element).tagName === 'svg'
        if (!isBg) return
        dragging.current = { x: e.clientX, y: e.clientY, tx, ty, moved: false }
      }}
      onMouseMove={(e) => {
        if (!dragging.current) return
        const dx = e.clientX - dragging.current.x
        const dy = e.clientY - dragging.current.y
        if (!dragging.current.moved && Math.hypot(dx, dy) > 3) dragging.current.moved = true
        if (dragging.current.moved) {
          setTx(dragging.current.tx + dx)
          setTy(dragging.current.ty + dy)
        }
      }}
      onMouseUp={() => {
        if (dragging.current && !dragging.current.moved && selected) onSelect?.(null)
        dragging.current = null
      }}
      onMouseLeave={() => {
        dragging.current = null
      }}
      onWheel={(e) => {
        const c = containerRef.current
        if (!c) return
        const rect = c.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
        const fitScale = Math.min(c.clientWidth / bounds.w, c.clientHeight / bounds.h) * 0.95
        const newScale = Math.max(fitScale, Math.min(8, scale * factor))
        setTx(mx - (mx - tx) * (newScale / scale))
        setTy(my - (my - ty) * (newScale / scale))
        setScale(newScale)
      }}
    >
      <svg className="w-full h-full block" style={{ imageRendering: 'pixelated' }}>
        <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
          {/* BASE LAYER — every game cell is a 4×4 grid of Pita tiles. For
              each sub-tile, compute its 4 corner "colors" by looking at which
              game cells touch each corner; pick the matching transition tile
              from the autotile lookup. Sub-tiles whose corners are all the
              same (no boundary nearby) fall back to the cell's biome pool
              for variety. */}
          {hexes.map((h) => {
            const v = fog.vis.get(axialKey(h)) ?? 'unknown'
            const baseX = h.q * CELL_SIZE
            const baseY = h.r * CELL_SIZE
            if (v === 'unknown') {
              return (
                <rect
                  key={`base-${axialKey(h)}`}
                  x={baseX}
                  y={baseY}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  fill="#0c0a07"
                />
              )
            }
            const opacity = v === 'scouted' ? 0.55 : 1

            // Pull biome from a sibling cell (used to determine corner colors).
            const biomeAt = (cx: number, cy: number): Biome | null => {
              return hexesByKey.get(`${cx},${cy}`)?.biome ?? null
            }

            // Determine the color of one of this sub-tile's 4 corners. The
            // corner's "terrain" is the highest-priority biome among all game
            // cells that touch it: ocean > coast > anything else.
            const corner = (sx: number, sy: number, idx: 0 | 1 | 2 | 3): CornerColor => {
              const dx = idx === 1 || idx === 3 ? 1 : 0
              const dy = idx >= 2 ? 1 : 0
              const sxAt = sx + dx
              const syAt = sy + dy
              const onLeft = sxAt === 0
              const onRight = sxAt === SUB
              const onTop = syAt === 0
              const onBottom = syAt === SUB
              const candidates: [number, number][] = [[h.q, h.r]]
              if (onLeft) candidates.push([h.q - 1, h.r])
              if (onRight) candidates.push([h.q + 1, h.r])
              if (onTop) candidates.push([h.q, h.r - 1])
              if (onBottom) candidates.push([h.q, h.r + 1])
              if (onLeft && onTop) candidates.push([h.q - 1, h.r - 1])
              if (onRight && onTop) candidates.push([h.q + 1, h.r - 1])
              if (onLeft && onBottom) candidates.push([h.q - 1, h.r + 1])
              if (onRight && onBottom) candidates.push([h.q + 1, h.r + 1])
              let hasOcean = false
              let hasCoast = false
              for (const [cx, cy] of candidates) {
                const b = biomeAt(cx, cy)
                if (b === 'ocean') hasOcean = true
                else if (b === 'coast') hasCoast = true
              }
              if (hasOcean) return 'water'
              if (hasCoast) return 'beach'
              return 'grass'
            }

            const subs: { x: number; y: number; src: string; animated?: boolean }[] = []
            for (let sy = 0; sy < SUB; sy++) {
              for (let sx = 0; sx < SUB; sx++) {
                const tl = corner(sx, sy, 0)
                const tr = corner(sx, sy, 1)
                const bl = corner(sx, sy, 2)
                const br = corner(sx, sy, 3)
                const allWater = tl === 'water' && tr === 'water' && bl === 'water' && br === 'water'
                if (allWater) {
                  subs.push({ x: baseX + sx * SUB_SIZE, y: baseY + sy * SUB_SIZE, src: '', animated: true })
                  continue
                }
                const allGrass = tl === 'grass' && tr === 'grass' && bl === 'grass' && br === 'grass'
                if (allGrass) {
                  // No boundary touches this sub-tile → fall back to the
                  // cell's biome pool (so plains stays planes, hills stays
                  // hills, etc., with proper variety).
                  const variant = pickTileVariant(h.biome, h.q, h.r, sx, sy)
                  subs.push({ x: baseX + sx * SUB_SIZE, y: baseY + sy * SUB_SIZE, src: tile(variant) })
                  continue
                }
                const key = `${cornerTerrainCode(tl)},${cornerTerrainCode(tr)},${cornerTerrainCode(bl)},${cornerTerrainCode(br)}`
                const at = AUTOTILE[key]
                if (at) {
                  subs.push({ x: baseX + sx * SUB_SIZE, y: baseY + sy * SUB_SIZE, src: tile(at) })
                } else {
                  // Unmatched combo — fall back to biome variant.
                  const variant = pickTileVariant(h.biome, h.q, h.r, sx, sy)
                  subs.push({ x: baseX + sx * SUB_SIZE, y: baseY + sy * SUB_SIZE, src: tile(variant) })
                }
              }
            }
            return (
              <g key={`base-${axialKey(h)}`} opacity={opacity}>
                {subs.map((s, i) =>
                  s.animated ? (
                    <rect
                      key={i}
                      x={s.x}
                      y={s.y}
                      width={SUB_SIZE}
                      height={SUB_SIZE}
                      fill="url(#tex-ocean)"
                    />
                  ) : (
                    <image
                      key={i}
                      x={s.x}
                      y={s.y}
                      width={SUB_SIZE}
                      height={SUB_SIZE}
                      href={s.src}
                      preserveAspectRatio="none"
                    />
                  ),
                )}
              </g>
            )
          })}

          {/* FOREST DECORATION — scatter ~6 trees per forest cell. */}
          {hexes.map((h) => {
            if (h.biome !== 'forest') return null
            if (mode === 'player' && !h.revealed) return null
            const baseX = h.q * CELL_SIZE
            const baseY = h.r * CELL_SIZE
            const trees: { x: number; y: number; size: number; src: string }[] = []
            const count = 6
            for (let i = 0; i < count; i++) {
              const seed = cellHash(h.q, h.r, i + 100)
              const u = (seed & 0xffff) / 0x10000
              const v = ((seed >> 16) & 0xffff) / 0x10000
              const variant = TREE_VARIANTS[((seed >> 4) & 0xff) % TREE_VARIANTS.length]
              const sizeMul = 0.85 + (((seed >> 8) & 0xff) / 256) * 0.4
              const size = SUB_SIZE * 1.5 * sizeMul
              const padding = size / 2
              trees.push({
                x: baseX + padding + u * (CELL_SIZE - 2 * padding) - size / 2,
                y: baseY + padding + v * (CELL_SIZE - 2 * padding) - size / 2,
                size,
                src: tile(variant),
              })
            }
            trees.sort((a, b) => a.y - b.y)
            return (
              <g key={`forest-${axialKey(h)}`} pointerEvents="none">
                {trees.map((t, i) => (
                  <image
                    key={i}
                    x={t.x}
                    y={t.y}
                    width={t.size}
                    height={t.size}
                    href={t.src}
                    preserveAspectRatio="none"
                  />
                ))}
              </g>
            )
          })}

          {/* MOUNTAIN ROCKS — extra clusters scattered on mountain cells. */}
          {hexes.map((h) => {
            if (h.biome !== 'mountain') return null
            if (mode === 'player' && !h.revealed) return null
            const baseX = h.q * CELL_SIZE
            const baseY = h.r * CELL_SIZE
            const rocks: { x: number; y: number; size: number; src: string }[] = []
            const count = 3
            for (let i = 0; i < count; i++) {
              const seed = cellHash(h.q, h.r, i + 200)
              const u = (seed & 0xffff) / 0x10000
              const v = ((seed >> 16) & 0xffff) / 0x10000
              const variant = ROCK_VARIANTS[((seed >> 4) & 0xff) % ROCK_VARIANTS.length]
              const size = SUB_SIZE * (0.9 + (((seed >> 8) & 0xff) / 256) * 0.3)
              const padding = size / 2
              rocks.push({
                x: baseX + padding + u * (CELL_SIZE - 2 * padding) - size / 2,
                y: baseY + padding + v * (CELL_SIZE - 2 * padding) - size / 2,
                size,
                src: tile(variant),
              })
            }
            rocks.sort((a, b) => a.y - b.y)
            return (
              <g key={`rock-${axialKey(h)}`} pointerEvents="none">
                {rocks.map((r, i) => (
                  <image
                    key={i}
                    x={r.x}
                    y={r.y}
                    width={r.size}
                    height={r.size}
                    href={r.src}
                    preserveAspectRatio="none"
                  />
                ))}
              </g>
            )
          })}

          {/* SETTLEMENT HOUSES — quick decorator for cells with location_type
              that should read as inhabited (village / city / fortress). */}
          {hexes.map((h) => {
            if (mode === 'player' && !h.revealed) return null
            const isInhabited =
              h.location_type === 'village' ||
              h.location_type === 'city' ||
              h.location_type === 'fortress'
            if (!isInhabited) return null
            const baseX = h.q * CELL_SIZE
            const baseY = h.r * CELL_SIZE
            const count = h.location_type === 'village' ? 3 : 5
            const houses: { x: number; y: number; size: number; src: string }[] = []
            const HOUSE_VARIANTS = ['house_0', 'house_1', 'house_2']
            for (let i = 0; i < count; i++) {
              const seed = cellHash(h.q, h.r, i + 300)
              const u = (seed & 0xffff) / 0x10000
              const v = ((seed >> 16) & 0xffff) / 0x10000
              const src = HOUSE_VARIANTS[((seed >> 4) & 0xff) % HOUSE_VARIANTS.length]
              const size = SUB_SIZE * (h.location_type === 'fortress' ? 1.3 : 1.1)
              const padding = size / 2 + SUB_SIZE * 0.3
              houses.push({
                x: baseX + padding + u * (CELL_SIZE - 2 * padding) - size / 2,
                y: baseY + padding + v * (CELL_SIZE - 2 * padding) - size / 2,
                size,
                src: tile(src),
              })
            }
            houses.sort((a, b) => a.y - b.y)
            return (
              <g key={`build-${axialKey(h)}`} pointerEvents="none">
                {houses.map((b, i) => (
                  <image
                    key={i}
                    x={b.x}
                    y={b.y}
                    width={b.size}
                    height={b.size}
                    href={b.src}
                    preserveAspectRatio="none"
                  />
                ))}
              </g>
            )
          })}

          {/* Region outlines — drawn once each (unlike the per-cell-side
              version which double-draws shared edges). */}
          {regionEdges.map((s, i) => (
            <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={3} strokeLinecap="square" opacity={0.85} />
          ))}

          {/* Selection ring */}
          {selected && (() => {
            const p = hexToPixel(selected, CELL_SIZE)
            const inset = 4
            return (
              <rect
                x={p.x + inset}
                y={p.y + inset}
                width={CELL_SIZE - inset * 2}
                height={CELL_SIZE - inset * 2}
                fill="none"
                stroke="#fff"
                strokeWidth={3}
                pointerEvents="none"
              />
            )
          })()}

          {/* Hit targets */}
          {hexes.map((h) => {
            const p = hexToPixel({ q: h.q, r: h.r }, CELL_SIZE)
            const isSelected = selected && selected.q === h.q && selected.r === h.r
            return (
              <rect
                key={`hit-${axialKey(h)}`}
                x={p.x}
                y={p.y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (isSelected) onSelect?.(null)
                  else onSelect?.({ q: h.q, r: h.r })
                }}
              />
            )
          })}

          {/* Location glyph (for non-settlement types like ruin/cave/temple) */}
          {hexes.map((h) => {
            if (!h.location_type) return null
            if (mode === 'player' && !h.revealed) return null
            // Skip for inhabited types since we render real houses
            if (h.location_type === 'village' || h.location_type === 'city' || h.location_type === 'fortress') return null
            const cc = cellCenter({ q: h.q, r: h.r }, CELL_SIZE)
            return <LocationIcon key={`loc-${axialKey(h)}`} type={h.location_type} cx={cc.x} cy={cc.y} />
          })}

          {/* Rivers */}
          {hexes.map((h) => {
            const edges = (h.generated?.rivers ?? []) as number[]
            if (edges.length === 0) return null
            if (mode === 'player' && !h.revealed) return null
            const cc = cellCenter({ q: h.q, r: h.r }, CELL_SIZE)
            const half = CELL_SIZE / 2
            const edgeMid = (e: number) => {
              switch (e) {
                case 0: return { x: cc.x + half, y: cc.y }
                case 1: return { x: cc.x, y: cc.y + half }
                case 2: return { x: cc.x - half, y: cc.y }
                case 3: return { x: cc.x, y: cc.y - half }
                default: return cc
              }
            }
            const stroke = '#3a7bc8'
            const strokeW = 6
            if (edges.length === 2) {
              const a = edgeMid(edges[0])
              const b = edgeMid(edges[1])
              return (
                <path key={`riv-${axialKey(h)}`} d={`M ${a.x} ${a.y} Q ${cc.x} ${cc.y} ${b.x} ${b.y}`} stroke={stroke} strokeWidth={strokeW} fill="none" strokeLinecap="round" pointerEvents="none" />
              )
            }
            return (
              <g key={`riv-${axialKey(h)}`} pointerEvents="none">
                {edges.map((e, i) => {
                  const m = edgeMid(e)
                  return <line key={i} x1={m.x} y1={m.y} x2={cc.x} y2={cc.y} stroke={stroke} strokeWidth={strokeW} strokeLinecap="round" />
                })}
              </g>
            )
          })}

          {/* Next-storm telegraph */}
          {nextStormCenter && (
            <g pointerEvents="none">
              <rect
                x={nextStormCenter.x - stormPixelRadius}
                y={nextStormCenter.y - stormPixelRadius}
                width={stormPixelRadius * 2}
                height={stormPixelRadius * 2}
                fill="#6b4e9a"
                opacity={0.18}
              />
              <rect
                x={nextStormCenter.x - stormPixelRadius}
                y={nextStormCenter.y - stormPixelRadius}
                width={stormPixelRadius * 2}
                height={stormPixelRadius * 2}
                fill="none"
                stroke="#6b4e9a"
                strokeWidth={3}
                strokeDasharray="8 8"
                opacity={0.7}
              />
              <text
                x={nextStormCenter.x}
                y={nextStormCenter.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(20, CELL_SIZE * 0.32)}
                fontWeight="bold"
                fill="#c9b3e6"
                fontFamily="Cinzel, serif"
                letterSpacing="0.15em"
                style={{ paintOrder: 'stroke', stroke: '#000c', strokeWidth: 5, strokeLinejoin: 'round' }}
              >
                NEXT
              </text>
            </g>
          )}

          {/* Live storm overlay */}
          <rect
            x={stormCenter.x - stormPixelRadius}
            y={stormCenter.y - stormPixelRadius}
            width={stormPixelRadius * 2}
            height={stormPixelRadius * 2}
            fill="#6b4e9a"
            opacity={0.45}
            pointerEvents="none"
          />
          <rect
            x={stormCenter.x - stormPixelRadius}
            y={stormCenter.y - stormPixelRadius}
            width={stormPixelRadius * 2}
            height={stormPixelRadius * 2}
            fill="none"
            stroke="#6b4e9a"
            strokeWidth={4}
            pointerEvents="none"
          />

          {/* Pins */}
          {Array.from(pinsByHex.entries()).map(([key, kinds]) => {
            const [qStr, rStr] = key.split(',')
            const cc = cellCenter({ q: parseInt(qStr, 10), r: parseInt(rStr, 10) }, CELL_SIZE)
            const total = kinds.length
            const spacing = 16
            const startX = cc.x - ((total - 1) * spacing) / 2
            const baseY = cc.y - CELL_SIZE * 0.42
            return (
              <g key={`pin-${key}`} pointerEvents="none">
                {kinds.map((k, i) => {
                  const cx = startX + i * spacing
                  const color = PIN_COLORS[k]
                  return (
                    <g key={`${key}-${i}`}>
                      <circle cx={cx} cy={baseY} r={8} fill={color} stroke="#000" strokeWidth={1.5} />
                      <polygon points={`${cx - 5},${baseY + 6} ${cx + 5},${baseY + 6} ${cx},${baseY + 16}`} fill={color} stroke="#000" strokeWidth={0.8} />
                    </g>
                  )
                })}
              </g>
            )
          })}

          {/* Final boss */}
          {finalBossCenter && mode === 'dm' && (
            <g pointerEvents="none">
              <circle cx={finalBossCenter.x} cy={finalBossCenter.y} r={CELL_SIZE * 0.22} fill="#220011" stroke="#ff3355" strokeWidth={3} />
              <text x={finalBossCenter.x} y={finalBossCenter.y + 8} textAnchor="middle" fontSize={26} fill="#ff8899" fontWeight="bold">
                ☠
              </text>
            </g>
          )}

          {/* Party */}
          <g pointerEvents="none">
            <circle cx={partyCenter.x} cy={partyCenter.y} r={CELL_SIZE * 0.22} fill="#fff7d6" stroke="#000" strokeWidth={2.5} />
            <text x={partyCenter.x} y={partyCenter.y + 9} textAnchor="middle" fontSize={28} fontWeight="bold" fill="#1a1407">
              ★
            </text>
          </g>

          {/* Region labels */}
          {regionLabels.map((rl, i) => (
            <text
              key={`rl-${i}`}
              x={rl.x}
              y={rl.y}
              textAnchor="middle"
              fontSize={Math.max(20, CELL_SIZE * 0.34)}
              fill={rl.color}
              fontFamily="Cinzel, serif"
              opacity={0.92}
              pointerEvents="none"
              style={{ paintOrder: 'stroke', stroke: '#000a', strokeWidth: 5, strokeLinejoin: 'round' }}
            >
              {rl.name}
            </text>
          ))}
        </g>
        <defs>
          <pattern id="tex-ocean" patternUnits="userSpaceOnUse" width={SUB_SIZE} height={SUB_SIZE}>
            <image
              width={SUB_SIZE}
              height={SUB_SIZE}
              preserveAspectRatio="none"
              href={tile('ocean_a0')}
            >
              <animate
                attributeName="href"
                values={[
                  tile('ocean_a0'),
                  tile('ocean_a1'),
                  tile('ocean_a2'),
                  tile('ocean_a3'),
                  tile('ocean_a2'),
                ].join(';')}
                dur="1.2s"
                repeatCount="indefinite"
              />
            </image>
          </pattern>
        </defs>
      </svg>
      {hudLabel && (
        <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded bg-ink-900/85 border border-ink-400/30 text-ink-100 text-xs font-display tracking-wide pointer-events-none">
          {hudLabel}
        </div>
      )}
    </div>
  )
}
