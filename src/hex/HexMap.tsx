import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TILE_SIZE,
  axialDistance,
  axialKey,
  cellCenter,
  hexToPixel,
  rectBounds,
  type Axial,
} from './coords'
import { BIOME_LABEL } from '../world/biomes'
import type { HexRow, RegionRow } from '../types/db'
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

// Tile asset paths — populated from public/textures/tiles/. The arrays are
// the variety pool for each biome; one is picked deterministically per cell.
const TILE_BASE = (name: string, base: string) => `${base}textures/tiles/${name}.png`
const BIOME_VARIANTS: Record<string, string[]> = {
  ocean: ['ocean_anim'], // sentinel — uses animated pattern below
  coast: ['coast_0'],
  plains: ['plains_0', 'plains_1', 'plains_2', 'plains_3', 'plains_4'],
  forest: ['plains_0', 'plains_1', 'plains_2'], // base ground; trees overlaid separately
  hills: ['hills_0', 'hills_1', 'hills_2'],
  mountain: ['mountain_0', 'mountain_1', 'mountain_2'],
  desert: ['desert'],
  swamp: ['swamp'],
  tundra: ['tundra'],
}
const TREE_VARIANTS = ['tree_0', 'tree_1', 'tree_2', 'tree_3', 'tree_4']

/** Cheap deterministic hash → uint32 derived from cell coords + a salt. */
function cellHash(q: number, r: number, salt: number): number {
  let h = (q * 73856093) ^ (r * 19349663) ^ (salt * 83492791)
  h = (h ^ (h >>> 16)) * 0x85ebca6b
  h = (h ^ (h >>> 13)) * 0xc2b2ae35
  h = h ^ (h >>> 16)
  return h >>> 0
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
  const bounds = useMemo(() => rectBounds(props.width, props.height), [props.width, props.height])
  const base = import.meta.env.BASE_URL

  // Pan/zoom state
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

  // For each cell, pick a deterministic variant tile from its biome pool.
  const tileSrc = (h: MapHex): string | null => {
    if (h.biome === 'ocean') return null // rendered via animated pattern instead
    const pool = BIOME_VARIANTS[h.biome] ?? [h.biome]
    const idx = cellHash(h.q, h.r, 1) % pool.length
    return TILE_BASE(pool[idx], base)
  }

  // Region outlines as axis-aligned segments between cells of different regions.
  const regionEdges = useMemo(() => {
    const segs: { x1: number; y1: number; x2: number; y2: number; color: string }[] = []
    const inset = 2
    for (const h of hexes) {
      if (!h.region_id) continue
      if (mode === 'player' && !fog.knownRegions.has(h.region_id)) continue
      const region = regionsById.get(h.region_id)
      if (!region) continue
      const color = region.color
      const left = h.q * TILE_SIZE
      const top = h.r * TILE_SIZE
      const right = left + TILE_SIZE
      const bottom = top + TILE_SIZE
      const sides: [Axial, [number, number, number, number]][] = [
        [{ q: h.q + 1, r: h.r }, [right - inset, top + inset, right - inset, bottom - inset]],
        [{ q: h.q - 1, r: h.r }, [left + inset, top + inset, left + inset, bottom - inset]],
        [{ q: h.q, r: h.r + 1 }, [left + inset, bottom - inset, right - inset, bottom - inset]],
        [{ q: h.q, r: h.r - 1 }, [left + inset, top + inset, right - inset, top + inset]],
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
      const c = cellCenter({ q: h.q, r: h.r })
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

  const stormCenter = cellCenter(stormHex)
  const stormPixelRadius = TILE_SIZE * (stormRadius + 0.5)
  const nextStormCenter = nextStormHex ? cellCenter(nextStormHex) : null
  const partyCenter = cellCenter(partyHex)
  const finalBossCenter = finalBoss ? cellCenter(finalBoss) : null

  const selectedHex = selected ? hexesByKey.get(`${selected.q},${selected.r}`) : null
  const hudLabel = selectedHex
    ? `${BIOME_LABEL[selectedHex.biome]} (${selected!.q}, ${selected!.r})`
    : null

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-ink-300 select-none"
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
          {/* Base biome tiles */}
          {hexes.map((h) => {
            const v = fog.vis.get(axialKey(h)) ?? 'unknown'
            const p = hexToPixel({ q: h.q, r: h.r })
            if (v === 'unknown') {
              return (
                <rect
                  key={`base-${axialKey(h)}`}
                  x={p.x}
                  y={p.y}
                  width={TILE_SIZE}
                  height={TILE_SIZE}
                  fill="#0c0a07"
                />
              )
            }
            const opacity = v === 'scouted' ? 0.55 : 1
            if (h.biome === 'ocean') {
              return (
                <rect
                  key={`base-${axialKey(h)}`}
                  x={p.x}
                  y={p.y}
                  width={TILE_SIZE}
                  height={TILE_SIZE}
                  fill="url(#tex-ocean)"
                  opacity={opacity}
                />
              )
            }
            const src = tileSrc(h)
            if (!src) return null
            return (
              <image
                key={`base-${axialKey(h)}`}
                x={p.x}
                y={p.y}
                width={TILE_SIZE}
                height={TILE_SIZE}
                href={src}
                opacity={opacity}
                preserveAspectRatio="none"
              />
            )
          })}

          {/* Forest tree scatter — 2-3 trees per forest cell, deterministic */}
          {hexes.map((h) => {
            if (h.biome !== 'forest') return null
            if (mode === 'player' && !h.revealed) return null
            const cc = cellCenter({ q: h.q, r: h.r })
            const trees = []
            for (let i = 0; i < 3; i++) {
              const seed = cellHash(h.q, h.r, i + 7)
              const ang = ((seed & 0xff) / 255) * Math.PI * 2
              const rad = (((seed >> 8) & 0xff) / 255) * (TILE_SIZE * 0.32)
              const variant = TREE_VARIANTS[((seed >> 16) & 0xff) % TREE_VARIANTS.length]
              const size = TILE_SIZE * 0.48
              trees.push({
                x: cc.x + Math.cos(ang) * rad - size / 2,
                y: cc.y + Math.sin(ang) * rad - size / 2 - size * 0.15,
                size,
                src: TILE_BASE(variant, base),
              })
            }
            // Sort by Y so back trees draw before front (depth illusion)
            trees.sort((a, b) => a.y - b.y)
            return (
              <g key={`forest-${axialKey(h)}`} pointerEvents="none">
                {trees.map((t, i) => (
                  <image key={i} x={t.x} y={t.y} width={t.size} height={t.size} href={t.src} preserveAspectRatio="none" />
                ))}
              </g>
            )
          })}

          {/* Mountain rock decoration */}
          {hexes.map((h) => {
            if (h.biome !== 'mountain') return null
            if (mode === 'player' && !h.revealed) return null
            const cc = cellCenter({ q: h.q, r: h.r })
            const rocks = []
            for (let i = 0; i < 2; i++) {
              const seed = cellHash(h.q, h.r, i + 11)
              const ang = ((seed & 0xff) / 255) * Math.PI * 2
              const rad = (((seed >> 8) & 0xff) / 255) * (TILE_SIZE * 0.25)
              const size = TILE_SIZE * 0.42
              rocks.push({
                x: cc.x + Math.cos(ang) * rad - size / 2,
                y: cc.y + Math.sin(ang) * rad - size / 2,
                size,
                src: TILE_BASE(i === 0 ? 'rock_0' : 'rock_1', base),
              })
            }
            return (
              <g key={`rock-${axialKey(h)}`} pointerEvents="none">
                {rocks.map((r, i) => (
                  <image key={i} x={r.x} y={r.y} width={r.size} height={r.size} href={r.src} preserveAspectRatio="none" />
                ))}
              </g>
            )
          })}

          {/* Region outlines (after biome but before pins/UI) */}
          {regionEdges.map((s, i) => (
            <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={2.5} strokeLinecap="square" opacity={0.85} />
          ))}

          {/* Selection indicator */}
          {selected && (() => {
            const p = hexToPixel(selected)
            const inset = TILE_SIZE * 0.08
            return (
              <rect
                x={p.x + inset}
                y={p.y + inset}
                width={TILE_SIZE - inset * 2}
                height={TILE_SIZE - inset * 2}
                fill="none"
                stroke="#fff"
                strokeWidth={2.5}
                pointerEvents="none"
              />
            )
          })()}

          {/* Click capture — square per cell, on top so events register reliably */}
          {hexes.map((h) => {
            const p = hexToPixel({ q: h.q, r: h.r })
            const isSelected = selected && selected.q === h.q && selected.r === h.r
            return (
              <rect
                key={`hit-${axialKey(h)}`}
                x={p.x}
                y={p.y}
                width={TILE_SIZE}
                height={TILE_SIZE}
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

          {/* Location glyph — drawn on top of base tile, scaled to cell */}
          {hexes.map((h) => {
            if (!h.location_type) return null
            if (mode === 'player' && !h.revealed) return null
            const cc = cellCenter({ q: h.q, r: h.r })
            return <LocationIcon key={`loc-${axialKey(h)}`} type={h.location_type} cx={cc.x} cy={cc.y} />
          })}

          {/* Rivers — same edge approach as before */}
          {hexes.map((h) => {
            const edges = (h.generated?.rivers ?? []) as number[]
            if (edges.length === 0) return null
            if (mode === 'player' && !h.revealed) return null
            const cc = cellCenter({ q: h.q, r: h.r })
            const half = TILE_SIZE / 2
            // Edge midpoints (matching NEIGHBORS order: E, S, W, N)
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
            const strokeW = 4
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
                strokeWidth={2.5}
                strokeDasharray="6 6"
                opacity={0.7}
              />
              <text
                x={nextStormCenter.x}
                y={nextStormCenter.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(14, TILE_SIZE * 0.4)}
                fontWeight="bold"
                fill="#c9b3e6"
                fontFamily="Cinzel, serif"
                letterSpacing="0.15em"
                style={{ paintOrder: 'stroke', stroke: '#000c', strokeWidth: 4, strokeLinejoin: 'round' }}
              >
                NEXT
              </text>
            </g>
          )}

          {/* Live storm overlay — flat purple square */}
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
            strokeWidth={3}
            pointerEvents="none"
          />

          {/* Pins */}
          {Array.from(pinsByHex.entries()).map(([key, kinds]) => {
            const [qStr, rStr] = key.split(',')
            const cc = cellCenter({ q: parseInt(qStr, 10), r: parseInt(rStr, 10) })
            const total = kinds.length
            const spacing = 12
            const startX = cc.x - ((total - 1) * spacing) / 2
            const baseY = cc.y - TILE_SIZE * 0.35
            return (
              <g key={`pin-${key}`} pointerEvents="none">
                {kinds.map((k, i) => {
                  const cx = startX + i * spacing
                  const color = PIN_COLORS[k]
                  return (
                    <g key={`${key}-${i}`}>
                      <circle cx={cx} cy={baseY} r={6} fill={color} stroke="#000" strokeWidth={1} />
                      <polygon points={`${cx - 4},${baseY + 5} ${cx + 4},${baseY + 5} ${cx},${baseY + 13}`} fill={color} stroke="#000" strokeWidth={0.5} />
                    </g>
                  )
                })}
              </g>
            )
          })}

          {/* Final boss marker (DM only) */}
          {finalBossCenter && mode === 'dm' && (
            <g pointerEvents="none">
              <circle cx={finalBossCenter.x} cy={finalBossCenter.y} r={TILE_SIZE * 0.32} fill="#220011" stroke="#ff3355" strokeWidth={2} />
              <text x={finalBossCenter.x} y={finalBossCenter.y + 5} textAnchor="middle" fontSize={16} fill="#ff8899" fontWeight="bold">
                ☠
              </text>
            </g>
          )}

          {/* Party token */}
          <g pointerEvents="none">
            <circle cx={partyCenter.x} cy={partyCenter.y} r={TILE_SIZE * 0.32} fill="#fff7d6" stroke="#000" strokeWidth={1.8} />
            <text x={partyCenter.x} y={partyCenter.y + 6} textAnchor="middle" fontSize={20} fontWeight="bold" fill="#1a1407">
              ★
            </text>
          </g>

          {/* Region labels at centroids */}
          {regionLabels.map((rl, i) => (
            <text
              key={`rl-${i}`}
              x={rl.x}
              y={rl.y}
              textAnchor="middle"
              fontSize={Math.max(14, TILE_SIZE * 0.42)}
              fill={rl.color}
              fontFamily="Cinzel, serif"
              opacity={0.9}
              pointerEvents="none"
              style={{ paintOrder: 'stroke', stroke: '#000a', strokeWidth: 4, strokeLinejoin: 'round' }}
            >
              {rl.name}
            </text>
          ))}
        </g>
        <defs>
          {/* Animated ocean — single pattern reused by every ocean cell. */}
          <pattern id="tex-ocean" patternUnits="userSpaceOnUse" width={TILE_SIZE} height={TILE_SIZE}>
            <image
              width={TILE_SIZE}
              height={TILE_SIZE}
              preserveAspectRatio="none"
              href={`${base}textures/tiles/ocean_a0.png`}
            >
              <animate
                attributeName="href"
                values={[
                  `${base}textures/tiles/ocean_a0.png`,
                  `${base}textures/tiles/ocean_a1.png`,
                  `${base}textures/tiles/ocean_a2.png`,
                  `${base}textures/tiles/ocean_a3.png`,
                  `${base}textures/tiles/ocean_a2.png`,
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
