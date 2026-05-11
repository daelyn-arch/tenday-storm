import { useEffect, useMemo, useRef, useState } from 'react'
import { generateMap, type GeneratedMap } from './generator'
import { loadTmxMeta, renderTmx } from './tmx'

interface Props {
  seed: number
  width: number
  height: number
  /**
   * If set, render this Tiled .tmx file directly (treated as source of truth
   * for tile placements) instead of generating procedurally. Useful for
   * showing what Pita's hand-crafted example maps look like.
   */
  tmxUrl?: string
}

const TILE = 16

/**
 * Continuous Pita-style overworld renderer. Bakes the entire tilemap to a
 * single canvas image at world-gen time and shows it as one SVG <image>.
 * Water depth is rendered into the bake (no animation right now — the
 * single repeating animated frame was creating a visible grid that was
 * worse than no animation. Will revisit with multi-cell foam sprites later).
 */
export function BeautifulMap({ seed, width, height, tmxUrl }: Props) {
  // TMX takes precedence: if a tmxUrl is provided, the map is hand-crafted
  // and we just render it. Otherwise generate procedurally.
  const generatedMap = useMemo(
    () => (tmxUrl ? null : generateMap(seed, width, height)),
    [seed, width, height, tmxUrl],
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [scale, setScale] = useState(1)
  const dragging = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const [bakedSrc, setBakedSrc] = useState<string | null>(null)
  // For TMX maps, we need the actual width/height from the file rather than
  // the props (which describe a procedural generation that isn't happening).
  const [mapDims, setMapDims] = useState<{ width: number; height: number }>({ width, height })

  useEffect(() => {
    let cancelled = false
    const base = (import.meta as ImportMeta).env.BASE_URL
    if (tmxUrl) {
      ;(async () => {
        const meta = await loadTmxMeta(tmxUrl)
        if (cancelled) return
        setMapDims(meta)
        const src = await renderTmx(tmxUrl, base)
        if (!cancelled) setBakedSrc(src)
      })().catch((e) => console.error('TMX render failed', e))
    } else if (generatedMap) {
      setMapDims({ width: generatedMap.width, height: generatedMap.height })
      bake(generatedMap).then((src) => {
        if (!cancelled) setBakedSrc(src)
      })
    }
    return () => {
      cancelled = true
    }
  }, [generatedMap, tmxUrl])

  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const cw = c.clientWidth
    const ch = c.clientHeight
    const mapW = mapDims.width * TILE
    const mapH = mapDims.height * TILE
    if (mapW === 0 || mapH === 0) return
    const sx = cw / mapW
    const sy = ch / mapH
    const s = Math.min(sx, sy) * 0.95
    setScale(s)
    setTx((cw - mapW * s) / 2)
    setTy((ch - mapH * s) / 2)
  }, [mapDims.width, mapDims.height])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#1a3550] select-none"
      onMouseDown={(e) => {
        if (e.button !== 0) return
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
        const fitScale = Math.min(c.clientWidth / (mapDims.width * TILE), c.clientHeight / (mapDims.height * TILE)) * 0.95
        const newScale = Math.max(fitScale * 0.9, Math.min(8, scale * factor))
        setTx(mx - (mx - tx) * (newScale / scale))
        setTy(my - (my - ty) * (newScale / scale))
        setScale(newScale)
      }}
    >
      <svg className="w-full h-full block" style={{ imageRendering: 'pixelated' }}>
        <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
          {bakedSrc && (
            <image
              href={bakedSrc}
              x={0}
              y={0}
              width={mapDims.width * TILE}
              height={mapDims.height * TILE}
              preserveAspectRatio="none"
            />
          )}
        </g>
      </svg>
    </div>
  )
}

async function bake(map: GeneratedMap): Promise<string> {
  const W = map.width * TILE
  const H = map.height * TILE
  const names = new Set<string>()
  for (const n of map.tileNames) if (n) names.add(n)
  for (const n of map.forestTiles) if (n) names.add(n)
  for (const d of map.decor) names.add(d.sprite)
  for (const s of map.structures) names.add(s.sprite)
  const base = (import.meta as ImportMeta).env.BASE_URL
  const images = await Promise.all(
    Array.from(names).map(
      (n) =>
        new Promise<[string, HTMLImageElement]>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve([n, img])
          img.onerror = () => reject(new Error(`Failed to load ${n}`))
          img.src = `${base}textures/tiles/${n}.png`
        }),
    ),
  )
  const imgMap = new Map(images)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas context unavailable')
  ctx.imageSmoothingEnabled = false

  // Pass 1 — base terrain
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x
      const name = map.tileNames[i]
      if (!name) continue
      const img = imgMap.get(name)
      if (!img) continue
      ctx.drawImage(img, x * TILE, y * TILE, TILE, TILE)
    }
  }

  // Pass 2 — forest cluster overlay (paints dense tree sprites on top of
  // grass for any cell flagged as forest).
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x
      if (!map.forest[i]) continue
      const name = map.forestTiles[i]
      if (!name) continue
      const img = imgMap.get(name)
      if (!img) continue
      ctx.drawImage(img, x * TILE, y * TILE, TILE, TILE)
    }
  }

  // Pass 3 — loose decor (rocks, etc.) — currently empty
  for (const d of map.decor) {
    const img = imgMap.get(d.sprite)
    if (!img) continue
    ctx.drawImage(img, d.x - d.size / 2, d.y - d.size / 2, d.size, d.size)
  }

  // Pass 4 — structures (placeholder houses)
  for (const s of map.structures) {
    const img = imgMap.get(s.sprite)
    if (!img) continue
    ctx.drawImage(img, s.x, s.y, s.w, s.h)
  }

  return canvas.toDataURL('image/png')
}
