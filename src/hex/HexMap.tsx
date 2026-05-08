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
import { BIOME_COLOR, BIOME_LABEL } from '../world/biomes'
import type { HexRow, RegionRow } from '../types/db'
import { LocationIcon } from './LocationIcon'

export interface MapHex extends Pick<HexRow, 'q' | 'r' | 'biome' | 'region_id' | 'revealed' | 'party_visited' | 'generated' | 'dm_notes' | 'location_type'> {}

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
  /** Next-day storm location to telegraph as a dashed outline. */
  nextStormHex?: Axial | null
  finalBoss?: Axial | null
  /** Quest/rumor/encounter pins to render on the map. */
  pins?: Pin[]
  selected?: Axial | null
  /** Receives the new selection or null to clear. */
  onSelect?: (next: Axial | null) => void
  mode: 'dm' | 'player'
}

interface FogState {
  /** "q,r" -> visibility tier */
  vis: Map<string, 'revealed' | 'scouted' | 'unknown'>
  /** region ids that should show outline+name to players */
  knownRegions: Set<string>
}

const PIN_COLORS: Record<PinKind, string> = {
  quest: '#ffd84a',
  rumor: '#e84a4a',
  encounter: '#ff9a3a',
  journal: '#5cc7ff',
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

  // Pan/zoom state
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [scale, setScale] = useState(1)
  // Track drag origin AND whether the cursor actually moved enough to count as
  // a pan. A click-without-drag on the map background counts as a deselect.
  const dragging = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null)
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

  // Region outlines: when two regions meet on an edge, both hexes contribute
  // a segment for that shared edge. We offset each segment a couple pixels
  // toward its own hex's center so the two colors appear as parallel stripes
  // instead of one hiding the other.
  const regionEdges = useMemo(() => {
    const segments: { d: string; color: string; regionId: string }[] = []
    const inset = 2 // pixels each segment is shifted toward its hex's center
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
        // Inward normal from edge midpoint toward this hex's center.
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        const dxn = center.x - mx
        const dyn = center.y - my
        const len = Math.hypot(dxn, dyn) || 1
        const ox = (dxn / len) * inset
        const oy = (dyn / len) * inset
        const ax = a.x + ox
        const ay = a.y + oy
        const bx = b.x + ox
        const by = b.y + oy
        segments.push({ d: `M ${ax} ${ay} L ${bx} ${by}`, color, regionId: h.region_id })
      }
    }
    return segments
  }, [hexes, hexesByKey, regionsById, fog.knownRegions, mode])

  // Region label positions: always average over ALL hexes in the region so the
  // label sits at the true centroid. Players see every region's name (the
  // realms are common knowledge), even though the hex-by-hex outlines remain
  // fog-of-war'd until they explore.
  const regionLabels = useMemo(() => {
    const acc = new Map<string, { x: number; y: number; n: number; name: string; color: string }>()
    for (const h of hexes) {
      if (!h.region_id) continue
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
  }, [hexes, regionsById])

  // Group pins by hex so we can fan them out instead of stacking on top of each other.
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

  // Storm circle pixel center. Visual radius scales with hex-radius so a
  // radius-3 storm visibly covers ~3 rings of hexes.
  const stormCenter = hexToPixel(stormHex)
  const stormPixelRadius = HEX_SIZE * (Math.sqrt(3) * stormRadius + 0.6)
  const nextStormCenter = nextStormHex ? hexToPixel(nextStormHex) : null
  const partyCenter = hexToPixel(partyHex)
  const finalBossCenter = finalBoss ? hexToPixel(finalBoss) : null

  // Selected-hex coord HUD content
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
        // Only start drag if not on a hex (i.e., target is the svg background).
        const isBg = (e.target as Element).tagName === 'svg'
        if (!isBg) return
        dragging.current = { x: e.clientX, y: e.clientY, tx, ty, moved: false }
      }}
      onMouseMove={(e) => {
        if (!dragging.current) return
        const dx = e.clientX - dragging.current.x
        const dy = e.clientY - dragging.current.y
        if (!dragging.current.moved && Math.hypot(dx, dy) > 3) {
          dragging.current.moved = true
        }
        if (dragging.current.moved) {
          setTx(dragging.current.tx + dx)
          setTy(dragging.current.ty + dy)
        }
      }}
      onMouseUp={() => {
        // A mousedown on the SVG bg without movement counts as "click empty
        // space" — clear the current selection.
        if (dragging.current && !dragging.current.moved && selected) {
          onSelect?.(null)
        }
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
        // Don't let the user zoom out further than "whole map fits". Recompute
        // the fit scale on every wheel so window resizes are respected.
        const fitScale = Math.min(c.clientWidth / bounds.w, c.clientHeight / bounds.h) * 0.95
        const newScale = Math.max(fitScale, Math.min(4, scale * factor))
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
            // Every biome now has a tile texture rendered via SVG <pattern>.
            const TEXTURED: Record<string, true> = {
              ocean: true,
              coast: true,
              plains: true,
              forest: true,
              hills: true,
              mountain: true,
              desert: true,
              swamp: true,
              tundra: true,
            }
            let fill = TEXTURED[h.biome] ? `url(#tex-${h.biome})` : BIOME_COLOR[h.biome]
            let opacity = 1
            if (v === 'scouted') {
              opacity = 0.55
            } else if (v === 'unknown') {
              fill = '#0c0a07'
              opacity = 1
            }
            const isSelected = selected && selected.q === h.q && selected.r === h.r
            return (
              <polygon
                key={axialKey(h)}
                points={hexPolygonPoints(p.x, p.y)}
                fill={fill}
                fillOpacity={opacity}
                stroke="#0008"
                strokeWidth={0.5}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  // Toggle: clicking the currently-selected hex deselects it.
                  if (isSelected) onSelect?.(null)
                  else onSelect?.({ q: h.q, r: h.r })
                }}
              />
            )
          })}

          {/* Region outlines */}
          {regionEdges.map((s, i) => (
            <path key={i} d={s.d} stroke={s.color} strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.85} />
          ))}

          {/* Forest decoration: scatter 2-3 small tree sprites per forest
              hex so the canopy reads as a real woodland rather than a flat
              green tile. Positions seeded off (q, r) so they don't shift
              between renders. */}
          {hexes.map((h) => {
            if (h.biome !== 'forest') return null
            if (mode === 'player' && !h.revealed) return null
            const center = hexToPixel({ q: h.q, r: h.r })
            // Cheap deterministic hash → 3 scatter offsets per hex.
            const seed = (h.q * 73856093) ^ (h.r * 19349663)
            const trees: { x: number; y: number; size: number }[] = []
            for (let i = 0; i < 3; i++) {
              const s = seed * (i + 1) * 2654435761
              const ang = ((s & 0xff) / 255) * Math.PI * 2
              const rad = (((s >> 8) & 0xff) / 255) * HEX_SIZE * 0.55
              const size = 16 + (((s >> 16) & 0xff) / 255) * 8
              trees.push({
                x: center.x + Math.cos(ang) * rad - size / 2,
                y: center.y + Math.sin(ang) * rad - size / 2,
                size,
              })
            }
            return (
              <g key={`forest-${axialKey(h)}`} pointerEvents="none">
                {trees.map((t, i) => (
                  <use key={i} href="#decor-tree" x={t.x} y={t.y} width={t.size} height={t.size} />
                ))}
              </g>
            )
          })}

          {/* Rivers — smooth blue curves through hexes that have river edges
              defined in their generated payload. Hidden on unrevealed hexes
              for players (rivers are geographical, but consistent with fog). */}
          {hexes.map((h) => {
            const edges = (h.generated?.rivers ?? []) as number[]
            if (edges.length === 0) return null
            if (mode === 'player' && !h.revealed) return null
            const center = hexToPixel({ q: h.q, r: h.r })
            const corners = hexCorners(center.x, center.y)
            const edgeMid = (e: number) => {
              const a = corners[e]
              const b = corners[(e + 1) % 6]
              return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
            }
            const stroke = '#3a7bc8'
            const strokeW = 2.6
            // 2 edges → smooth quadratic curve through the center.
            // 1 edge → short stub from edge midpoint to center (river end).
            // 3+ edges → spoke from each edge midpoint to center.
            if (edges.length === 2) {
              const a = edgeMid(edges[0])
              const b = edgeMid(edges[1])
              return (
                <path
                  key={`riv-${axialKey(h)}`}
                  d={`M ${a.x} ${a.y} Q ${center.x} ${center.y} ${b.x} ${b.y}`}
                  stroke={stroke}
                  strokeWidth={strokeW}
                  fill="none"
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              )
            }
            return (
              <g key={`riv-${axialKey(h)}`} pointerEvents="none">
                {edges.map((e, i) => {
                  const m = edgeMid(e)
                  return (
                    <line
                      key={i}
                      x1={m.x}
                      y1={m.y}
                      x2={center.x}
                      y2={center.y}
                      stroke={stroke}
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                    />
                  )
                })}
              </g>
            )
          })}

          {/* Location icons (village / city / temple / etc.). Players only see
              icons on revealed hexes — unrevealed landmarks stay secret. */}
          {hexes.map((h) => {
            if (!h.location_type) return null
            if (mode === 'player' && !h.revealed) return null
            const p = hexToPixel({ q: h.q, r: h.r })
            return (
              <LocationIcon
                key={`loc-${axialKey(h)}`}
                type={h.location_type}
                cx={p.x}
                cy={p.y}
              />
            )
          })}

          {/* Selection indicator: a smaller hex inside the selected tile so the
              region borders remain visible alongside it. */}
          {selected && (() => {
            const sp = hexToPixel(selected)
            return (
              <polygon
                points={hexPolygonPoints(sp.x, sp.y, HEX_SIZE * 0.82)}
                fill="none"
                stroke="#fff"
                strokeWidth={2}
                pointerEvents="none"
              />
            )
          })()}

          {/* Next-day storm telegraph (DM always; players only when DM has
              flipped the tracker on, which represents a spell or item). */}
          {nextStormCenter && (
            <g pointerEvents="none">
              <circle
                cx={nextStormCenter.x}
                cy={nextStormCenter.y}
                r={stormPixelRadius}
                fill="url(#stormGrad)"
                opacity={0.18}
              />
              <circle
                cx={nextStormCenter.x}
                cy={nextStormCenter.y}
                r={stormPixelRadius}
                fill="none"
                stroke="#9a7fbf"
                strokeWidth={1.5}
                strokeDasharray="3 6"
                opacity={0.7}
              />
              <text
                x={nextStormCenter.x}
                y={nextStormCenter.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(14, HEX_SIZE * 0.55)}
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

          {/* Storm overlay — flat purple fill + solid ring so the storm is
              unambiguously visible and bounded. */}
          <circle
            cx={stormCenter.x}
            cy={stormCenter.y}
            r={stormPixelRadius}
            fill="#6b4e9a"
            opacity={0.45}
            pointerEvents="none"
          />
          <circle
            cx={stormCenter.x}
            cy={stormCenter.y}
            r={stormPixelRadius}
            fill="none"
            stroke="#6b4e9a"
            strokeWidth={3}
            pointerEvents="none"
          />

          {/* Quest/rumor/encounter pins. Cluster siblings on the same hex by
              fanning them horizontally so each is visible. */}
          {Array.from(pinsByHex.entries()).map(([key, kinds]) => {
            const [qStr, rStr] = key.split(',')
            const p = hexToPixel({ q: parseInt(qStr, 10), r: parseInt(rStr, 10) })
            const total = kinds.length
            const spacing = 10
            const startX = p.x - ((total - 1) * spacing) / 2
            const baseY = p.y - HEX_SIZE * 0.35
            return (
              <g key={`pin-${key}`} pointerEvents="none">
                {kinds.map((k, i) => {
                  const cx = startX + i * spacing
                  const color = PIN_COLORS[k]
                  return (
                    <g key={`${key}-${i}`}>
                      <circle cx={cx} cy={baseY} r={5} fill={color} stroke="#000" strokeWidth={1} />
                      <polygon
                        points={`${cx - 3.5},${baseY + 4} ${cx + 3.5},${baseY + 4} ${cx},${baseY + 11}`}
                        fill={color}
                        stroke="#000"
                        strokeWidth={0.5}
                      />
                    </g>
                  )
                })}
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
          {/* Biome textures rendered as tiled SVG patterns. patternUnits in
              userSpaceOnUse means the pattern tiles in the SVG's coordinate
              system, so all hexes share a continuous tiled image rather than
              each hex showing the same cropped tile. */}
          {(['coast', 'plains', 'forest', 'hills', 'mountain', 'desert', 'swamp', 'tundra'] as const).map(
            (biome) => (
              <pattern
                key={biome}
                id={`tex-${biome}`}
                patternUnits="userSpaceOnUse"
                width={56}
                height={56}
              >
                <image
                  href={`${import.meta.env.BASE_URL}textures/tiles/${biome}.png`}
                  width={56}
                  height={56}
                  preserveAspectRatio="xMidYMid slice"
                  style={{ imageRendering: 'pixelated' }}
                />
              </pattern>
            ),
          )}
          {/* Ocean animates between four wave frames at ~240ms each. SVG
              <animate> on the href cycles them declaratively — no React
              state thrash, no rAF needed. */}
          <pattern id="tex-ocean" patternUnits="userSpaceOnUse" width={56} height={56}>
            <image
              width={56}
              height={56}
              preserveAspectRatio="xMidYMid slice"
              style={{ imageRendering: 'pixelated' }}
              href={`${import.meta.env.BASE_URL}textures/tiles/ocean_0.png`}
            >
              <animate
                attributeName="href"
                values={[
                  `${import.meta.env.BASE_URL}textures/tiles/ocean_0.png`,
                  `${import.meta.env.BASE_URL}textures/tiles/ocean_1.png`,
                  `${import.meta.env.BASE_URL}textures/tiles/ocean_2.png`,
                  `${import.meta.env.BASE_URL}textures/tiles/ocean_3.png`,
                  `${import.meta.env.BASE_URL}textures/tiles/ocean_2.png`,
                ].join(';')}
                dur="1.2s"
                repeatCount="indefinite"
              />
            </image>
          </pattern>
          {/* Tree sprite for scattering on forest hexes. */}
          <symbol id="decor-tree" viewBox="0 0 64 64">
            <image
              href={`${import.meta.env.BASE_URL}textures/tiles/decor_tree.png`}
              width={64}
              height={64}
              style={{ imageRendering: 'pixelated' }}
            />
          </symbol>
        </defs>
      </svg>
      {/* Selected-tile coord HUD, anchored bottom-right of the map area. */}
      {hudLabel && (
        <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded bg-ink-900/85 border border-ink-400/30 text-ink-100 text-xs font-display tracking-wide pointer-events-none">
          {hudLabel}
        </div>
      )}
    </div>
  )
}
