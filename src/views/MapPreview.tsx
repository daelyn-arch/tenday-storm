import { useSearchParams } from 'react-router-dom'
import { BeautifulMap } from '../map/BeautifulMap'

/**
 * Auth-free preview. Compare Pita's hand-crafted TMX examples against
 * Wave Function Collapse output trained on those same examples.
 *
 *   /#/preview               → Scenes.tmx (raw example)
 *   /#/preview?map=guide     → GuideExamples.tmx (raw example)
 *   /#/preview?wfc=1         → WFC seed=1 trained on Scenes.tmx
 *   /#/preview?wfc=42        → WFC seed=42
 *   /#/preview?wfc=42&size=80x60 → custom size
 */
export function MapPreview() {
  const [params] = useSearchParams()
  const which = params.get('map')
  const wfcSeed = params.get('wfc')
  const sizeParam = params.get('size') ?? '60x40'
  const [w, h] = sizeParam.split('x').map((s) => parseInt(s, 10) || 60)
  const base = import.meta.env.BASE_URL

  const trainingTmx =
    which === 'guide'
      ? `${base}textures/_pita/GuideExamples.tmx`
      : `${base}textures/_pita/Scenes.tmx`

  const wfcConfig =
    wfcSeed != null
      ? { width: w, height: h, seed: parseInt(wfcSeed, 10) || 1 }
      : undefined

  return (
    <div className="h-screen flex flex-col">
      <header className="px-4 py-2 bg-ink-900/80 border-b border-ink-700 text-sm text-ink-200 font-display flex items-center gap-3 flex-wrap">
        <a className="text-storm-400 underline" href="#/preview">Scenes.tmx</a>
        <a className="text-storm-400 underline" href="#/preview?map=guide">GuideExamples.tmx</a>
        <span className="text-ink-400">|</span>
        <a className="text-storm-400 underline" href="#/preview?wfc=1">WFC #1</a>
        <a className="text-storm-400 underline" href="#/preview?wfc=42">#42</a>
        <a className="text-storm-400 underline" href="#/preview?wfc=9973">#9973</a>
        <a className="text-storm-400 underline" href="#/preview?wfc=12345">#12345</a>
        <span className="ml-auto text-ink-300">
          {wfcConfig ? `WFC ${w}×${h} seed=${wfcConfig.seed}` : trainingTmx.split('/').pop()}
        </span>
      </header>
      <div className="flex-1 min-h-0">
        <BeautifulMap tmxUrl={trainingTmx} wfc={wfcConfig} />
      </div>
    </div>
  )
}
