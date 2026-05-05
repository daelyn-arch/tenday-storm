import { useEffect, useMemo, useRef, useState } from 'react'
import {
  HEX_SIZE,
  axialDistance,
  axialKey,
  hexCorners,
  hexPolygonPoints,
  hexToPixel,
  rectBounds,
  type Axial,
} from './coords'
import { BIOME_COLOR } from '../world/biomes'
import type { HexRow, RegionRow, ItemRow } from '../types/db'

export interface MapHex extends Pick<HexRow, 'q' | 'r' | 'biome' | 'region_id' | 'revealed' | 'party_visited' | 'generated' | 'dm_notes'> {}

export interface HexMapProps {
  width: number
  height: number
  hexes: MapHex[]
  regions: RegionRow[]
  partyHex: Axial
  stormHex: Axial
  stormPath?: Axial[]
  finalBoss?: Axial | null
  items?: Pick<ItemRow, 'name' | 'hex_q' | 'hex_r' | 'is_real' | 'discovered'>[]
  selected?: Axial | null
  onSelect?: (q: number, r: number) => void
  mode: 'dm' | 'player'
}

interface FogState {
  /** "q,r" -> visibility tier */
  vis: Map<string, 'revealed' | 'scouted' | 'unknown'>
  /** region ids that should show outline+name to players */
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
  const { hexes, regions, partyHex, stormHex, stormPath, finalBoss, items, selected, onSelect, mode } = props
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

  // Pan/zoom state
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [scale, setScale] = useState(1)
  const dragging = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Fit map on first render.
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

  // Region outlines (precomputed segments)
  const regionEdges = useMemo(() => {
    const segments: { d: string; color: string; regionId: string }[] = []
    for (const h of hexes) {
      if (!h.region_id) continue
      if (mode === 'player' && !fog.knownRegions.has(h.region_id)) continue
      const center = hexToPixel({ q: h.q, r: h.r })
      const corners = hexCorners(center.x, center.y)
      for (let i = 0; i < 6; i++) {
        // Neighbor order matches edge i: see NEIGHBORS in coords.ts.
        const dirs = [
          { q: 1, r: 0 },
          { q: 0, r: 1 },
          { q: -1, r: 1 },
          { q: -1, r: 0 },
          { q: 0, r: -1 },
          { q: 1, r: -1 },
        ]
        const n = { q: h.q + dirs[i].q, r: h.r + dirs[i].r }
        const nh = hexesByKey.get(axialKey(n))
        const sameRegion = nh && nh.region_id === h.region_id
        if (sameRegion) continue
        const a = corners[i]
        const b = corners[(i + 1) % 6]
        const region = regionsById.get(h.region_id)
        const color = region?.color ?? '#fff'
        segments.push({ d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, color, regionId: h.region_id })
      }
    }
    return segments
  }, [hexes, hexesByKey, regionsById, fog.knownRegions, mode])

  // Region label positions: average of revealed hexes in each region (player) or all hexes (DM).
  const regionLabels = useMemo(() => {
    const acc = new Map<string, { x: number; y: number; n: number; name: string; color: string }>()
    for (const h of hexes) {
      if (!h.region_id) continue
      if (mode === 'player' && !fog.knownRegions.has(h.region_id)) continue
      const region = regionsById.get(h.region_id)
      if (!region) continue
      const p = hexToPixel({ q: h.q, r: h.r })
      const cur = acc.get(h.region_id) ?? { x: 0, y: 0, n: 0, name: region.name, color: region.color }
      cur.x += p.x
      cur.y += p.y
      cur.n += 1
      acc.set(h.region_id, cur)
    }
    return Array.from(acc.values()).map((v) => ({
      x: v.x / v.n,
      y: v.y / v.n,
      name: v.name,
      color: v.color,
    }))
  }, [hexes, regionsById, fog.knownRegions, mode])

  // Visible items
  const visibleItems = useMemo(() => {
    if (!items) return []
    return items.filter((it) => {
      if (it.hex_q == null || it.hex_r == null) return false
      if (mode === 'dm') return true
      // Player: only if discovered
      return it.discovered && it.is_real
    })
  }, [items, mode])

  // Storm circle pixel center
  const stormCenter = hexToPixel(stormHex)
  const partyCenter = hexToPixel(partyHex)
  const finalBossCenter = finalBoss ? hexToPixel(finalBoss) : null

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-ink-900 select-none"
      onMouseDown={(e) => {
        if (e.button !== 0) return
        // Only start drag if not on a hex (i.e., target is the svg background).
        const isBg = (e.target as Element).tagName === 'svg'
        if (!isBg) return
        dragging.current = { x: e.clientX, y: e.clientY, tx, ty }
      }}
      onMouseMove={(e) => {
        if (!dragging.current) return
        setTx(dragging.current.tx + (e.clientX - dragging.current.x))
        setTy(dragging.current.ty + (e.clientY - dragging.current.y))
      }}
      onMouseUp={() => {
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
        const newScale = Math.max(0.2, Math.min(4, scale * factor))
        // Keep mouse-locked zoom.
        setTx(mx - (mx - tx) * (newScale / scale))
        setTy(my - (my - ty) * (newScale / scale))
        setScale(newScale)
      }}
    >
      <svg className="w-full h-full block">
        <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
          {/* Hex tiles */}
          {hexes.map((h) => {
            const p = hexToPixel({ q: h.q, r: h.r })
            const v = fog.vis.get(axialKey(h)) ?? 'unknown'
            const isSelected = selected && selected.q === h.q && selected.r === h.r
            let fill = BIOME_COLOR[h.biome]
            let opacity = 1
            if (v === 'scouted') {
              opacity = 0.55
            } else if (v === 'unknown') {
              fill = '#0c0a07'
              opacity = 1
            }
            return (
              <polygon
                key={axialKey(h)}
                points={hexPolygonPoints(p.x, p.y)}
                fill={fill}
                fillOpacity={opacity}
                stroke={isSelected ? '#fff' : '#0008'}
                strokeWidth={isSelected ? 2.5 : 0.5}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect?.(h.q, h.r)
                }}
              />
            )
          })}

          {/* Region outlines */}
          {regionEdges.map((s, i) => (
            <path key={i} d={s.d} stroke={s.color} strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.85} />
          ))}

          {/* Storm path preview (DM only) */}
          {mode === 'dm' && stormPath && stormPath.length > 1 && (
            <polyline
              points={stormPath.map((p) => {
                const pp = hexToPixel(p)
                return `${pp.x},${pp.y}`
              }).join(' ')}
              fill="none"
              stroke="#9a7fbf"
              strokeWidth={2}
              strokeDasharray="6 6"
              opacity={0.5}
            />
          )}

          {/* Storm overlay */}
          <circle
            cx={stormCenter.x}
            cy={stormCenter.y}
            r={HEX_SIZE * 1.6}
            fill="url(#stormGrad)"
            opacity={0.55}
            pointerEvents="none"
          />
          <circle
            cx={stormCenter.x}
            cy={stormCenter.y}
            r={HEX_SIZE * 1.6}
            fill="none"
            stroke="#9a7fbf"
            strokeWidth={2}
            strokeDasharray="4 4"
            pointerEvents="none"
          />

          {/* Item markers */}
          {visibleItems.map((it, i) => {
            const p = hexToPixel({ q: it.hex_q!, r: it.hex_r! })
            const color = mode === 'dm' ? (it.is_real ? '#ffd84a' : '#7a6a4a') : '#ffd84a'
            return (
              <g key={`item-${i}`} pointerEvents="none">
                <circle cx={p.x} cy={p.y - HEX_SIZE * 0.25} r={6} fill={color} stroke="#000" strokeWidth={1} />
                <polygon
                  points={`${p.x - 4},${p.y - HEX_SIZE * 0.25 + 5} ${p.x + 4},${p.y - HEX_SIZE * 0.25 + 5} ${p.x},${p.y - HEX_SIZE * 0.25 + 12}`}
                  fill={color}
                />
              </g>
            )
          })}

          {/* Final boss marker (DM always; player after storm reaches it) */}
          {finalBossCenter && mode === 'dm' && (
            <g pointerEvents="none">
              <circle cx={finalBossCenter.x} cy={finalBossCenter.y} r={HEX_SIZE * 0.45} fill="#220011" stroke="#ff3355" strokeWidth={2} />
              <text
                x={finalBossCenter.x}
                y={finalBossCenter.y + 4}
                textAnchor="middle"
                fontSize={14}
                fill="#ff8899"
                fontWeight="bold"
              >
                ☠
              </text>
            </g>
          )}

          {/* Party token (always visible) */}
          <g pointerEvents="none">
            <circle cx={partyCenter.x} cy={partyCenter.y} r={HEX_SIZE * 0.45} fill="#fff7d6" stroke="#000" strokeWidth={1.5} />
            <text x={partyCenter.x} y={partyCenter.y + 5} textAnchor="middle" fontSize={16} fontWeight="bold" fill="#1a1407">
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
              fontSize={Math.max(11, HEX_SIZE * 0.5)}
              fill={rl.color}
              fontFamily="Cinzel, serif"
              opacity={0.85}
              pointerEvents="none"
              style={{ paintOrder: 'stroke', stroke: '#000a', strokeWidth: 3, strokeLinejoin: 'round' }}
            >
              {rl.name}
            </text>
          ))}
        </g>
        <defs>
          <radialGradient id="stormGrad">
            <stop offset="0%" stopColor="#241945" />
            <stop offset="100%" stopColor="#241945" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  )
}
