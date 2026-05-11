import { useEffect, useRef, useState } from 'react'
import { loadTmxMeta, renderTmx, renderTileGrid } from './tmx'
import { generateFromTmx } from './wfc'
import { generatePoiMap } from './poi-generator'

interface Props {
  /** TMX url to render directly (the hand-crafted source map). */
  tmxUrl?: string
  /** WFC mode: train on tmxUrl, generate at this size + seed. */
  wfc?: { width: number; height: number; seed: number }
  /** POI-first mode: procedurally place POIs and paint terrain around them. */
  poi?: { width: number; height: number; seed: number }
}

const TILE = 16

/**
 * Thin Pita-TMX renderer. Bakes the entire .tmx to a single canvas image
 * at mount time and shows it as one SVG <image> with pan/zoom. The
 * procedural generator has been removed — every map is now sourced from
 * Pita's hand-crafted examples. Next iteration: study these TMX patterns
 * to design a generator that produces output of similar quality.
 */
export function BeautifulMap({ tmxUrl, wfc, poi }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [scale, setScale] = useState(1)
  const dragging = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const [bakedSrc, setBakedSrc] = useState<string | null>(null)
  const [mapDims, setMapDims] = useState<{ width: number; height: number }>({ width: 1, height: 1 })

  useEffect(() => {
    let cancelled = false
    const base = (import.meta as ImportMeta).env.BASE_URL
    if (poi) {
      ;(async () => {
        const generated = await generatePoiMap(poi.seed, poi.width, poi.height, base)
        if (cancelled) return
        setMapDims({ width: generated.width, height: generated.height })
        const src = await renderTileGrid(generated, base)
        if (!cancelled) setBakedSrc(src)
      })().catch((e) => console.error('POI generation failed', e))
    } else if (wfc && tmxUrl) {
      ;(async () => {
        const generated = await generateFromTmx(tmxUrl, wfc.width, wfc.height, wfc.seed)
        if (cancelled) return
        setMapDims({ width: generated.width, height: generated.height })
        const src = await renderTileGrid(generated, base)
        if (!cancelled) setBakedSrc(src)
      })().catch((e) => console.error('WFC generation failed', e))
    } else if (tmxUrl) {
      ;(async () => {
        const meta = await loadTmxMeta(tmxUrl)
        if (cancelled) return
        setMapDims(meta)
        const src = await renderTmx(tmxUrl, base)
        if (!cancelled) setBakedSrc(src)
      })().catch((e) => console.error('TMX render failed', e))
    }
    return () => {
      cancelled = true
    }
  }, [tmxUrl, wfc, poi])

  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const cw = c.clientWidth
    const ch = c.clientHeight
    const mapW = mapDims.width * TILE
    const mapH = mapDims.height * TILE
    if (mapW <= 1 || mapH <= 1) return
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
