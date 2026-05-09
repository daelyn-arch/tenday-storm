import { useEffect, useMemo, useRef, useState } from 'react'
import { generateMap, type GeneratedMap } from './generator'

interface Props {
  seed: number
  width: number
  height: number
}

const TILE = 16

/**
 * Continuous Pita-style overworld renderer. The base layer is pre-baked into
 * an offscreen canvas at world-gen time and shown as a single <img> — that
 * way 30k tiles render in one paint instead of 30k SVG elements. Water tiles
 * are rendered separately via an SVG <pattern> with <animate> on the href so
 * waves animate without re-baking the canvas.
 */
export function BeautifulMap({ seed, width, height }: Props) {
  const map = useMemo(() => generateMap(seed, width, height), [seed, width, height])

  const containerRef = useRef<HTMLDivElement>(null)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [scale, setScale] = useState(1)
  const dragging = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  // Bake the base + decor + structures to a single canvas → data URL.
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

  // Fit on first render
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

  // Animated water rectangles — only emit one <rect> per animated tile
  // (water cells never get baked, so they're transparent on the canvas).
  const waterRects = useMemo(() => {
    const rects: { x: number; y: number }[] = []
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.animated[y * map.width + x]) {
          rects.push({ x: x * TILE, y: y * TILE })
        }
      }
    }
    return rects
  }, [map])

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
      <svg
        className="w-full h-full block"
        style={{ imageRendering: 'pixelated' }}
      >
        <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
          {/* Base layer — entire map baked to one image */}
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
          {/* Animated water cells — one rect each, all share one pattern */}
          {waterRects.map((r, i) => (
            <rect
              key={i}
              x={r.x}
              y={r.y}
              width={TILE}
              height={TILE}
              fill="url(#beautiful-ocean)"
            />
          ))}
        </g>
        <defs>
          <pattern id="beautiful-ocean" patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
            <image
              width={TILE}
              height={TILE}
              preserveAspectRatio="none"
              href={`${import.meta.env.BASE_URL}textures/tiles/ocean_a0.png`}
            >
              <animate
                attributeName="href"
                values={[
                  `${import.meta.env.BASE_URL}textures/tiles/ocean_a0.png`,
                  `${import.meta.env.BASE_URL}textures/tiles/ocean_a1.png`,
                  `${import.meta.env.BASE_URL}textures/tiles/ocean_a2.png`,
                  `${import.meta.env.BASE_URL}textures/tiles/ocean_a3.png`,
                  `${import.meta.env.BASE_URL}textures/tiles/ocean_a2.png`,
                ].join(';')}
                dur="1.2s"
                repeatCount="indefinite"
              />
            </image>
          </pattern>
        </defs>
      </svg>
    </div>
  )
}

/**
 * Bake the static layers of the generated map to an OffscreenCanvas, return
 * a data URL. This is the heavy lift but it only runs once per map.
 */
async function bake(map: GeneratedMap): Promise<string> {
  const TILE = 16
  const W = map.width * TILE
  const H = map.height * TILE
  // Collect every unique sprite filename we'll need
  const names = new Set<string>()
  for (const n of map.tileNames) if (n) names.add(n)
  for (const d of map.decor) names.add(d.sprite)
  for (const s of map.structures) names.add(s.sprite)
  // Load them all in parallel
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

  // Use a regular canvas (OffscreenCanvas not universally supported)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas context unavailable')
  ctx.imageSmoothingEnabled = false

  // Base tiles
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x
      if (map.animated[i]) continue // animated water — leave transparent for SVG layer
      const name = map.tileNames[i]
      if (!name) continue
      const img = imgMap.get(name)
      if (!img) continue
      ctx.drawImage(img, x * TILE, y * TILE, TILE, TILE)
    }
  }
  // Decor (trees, rocks)
  for (const d of map.decor) {
    const img = imgMap.get(d.sprite)
    if (!img) continue
    ctx.drawImage(img, d.x - d.size / 2, d.y - d.size / 2, d.size, d.size)
  }
  // Structures (houses for now; multi-tile sprites later)
  for (const s of map.structures) {
    const img = imgMap.get(s.sprite)
    if (!img) continue
    ctx.drawImage(img, s.x, s.y, s.w, s.h)
  }
  return canvas.toDataURL('image/png')
}
