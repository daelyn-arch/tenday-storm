import { useEffect, useMemo, useRef, useState } from 'react'
import { generateMap, type GeneratedMap } from './generator'

interface Props {
  seed: number
  width: number
  height: number
}

const TILE = 16

/**
 * Continuous Pita-style overworld renderer. Bakes the entire tilemap to a
 * single canvas image at world-gen time and shows it as one SVG <image>.
 * Water depth is rendered into the bake (no animation right now — the
 * single repeating animated frame was creating a visible grid that was
 * worse than no animation. Will revisit with multi-cell foam sprites later).
 */
export function BeautifulMap({ seed, width, height }: Props) {
  const map = useMemo(() => generateMap(seed, width, height), [seed, width, height])

  const containerRef = useRef<HTMLDivElement>(null)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [scale, setScale] = useState(1)
  const dragging = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const [bakedSrc, setBakedSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    bake(map).then((src) => {
      if (!cancelled) setBakedSrc(src)
    })
    return () => {
      cancelled = true
    }
  }, [map])

  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const cw = c.clientWidth
    const ch = c.clientHeight
    const mapW = map.width * TILE
    const mapH = map.height * TILE
    const sx = cw / mapW
    const sy = ch / mapH
    const s = Math.min(sx, sy) * 0.95
    setScale(s)
    setTx((cw - mapW * s) / 2)
    setTy((ch - mapH * s) / 2)
  }, [map.width, map.height])

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
        const fitScale = Math.min(c.clientWidth / (map.width * TILE), c.clientHeight / (map.height * TILE)) * 0.95
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
              width={map.width * TILE}
              height={map.height * TILE}
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
