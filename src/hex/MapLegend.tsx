import { BIOMES, BIOME_COLOR, BIOME_LABEL } from '../world/biomes'

/**
 * Small overlay legend rendered inside HexMap. Color is the only biome cue
 * now that we've dropped the per-biome glyphs/textures, so the legend earns
 * its rent. Pointer-events disabled so it never eats map clicks.
 */
export function MapLegend() {
  return (
    <div
      className="absolute top-3 left-3 px-3 py-2.5 rounded bg-ink-900/85 border border-ink-400/30 text-ink-100 text-xs pointer-events-none"
      aria-hidden="true"
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-2 font-display">
        Biomes
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {BIOMES.map((b) => (
          <div key={b} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm border border-black/40"
              style={{ background: BIOME_COLOR[b] }}
            />
            <span className="text-ink-100">{BIOME_LABEL[b]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
