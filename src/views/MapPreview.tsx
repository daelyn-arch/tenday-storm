import { useSearchParams } from 'react-router-dom'
import { BeautifulMap } from '../map/BeautifulMap'

/**
 * Auth-free route to preview a TMX or procedural map. Useful for evaluating
 * the renderer without going through the campaign flow.
 *
 *   /#/preview            → Scenes.tmx (Pita's example)
 *   /#/preview?map=guide  → GuideExamples.tmx
 *   /#/preview?seed=42    → procedural map with seed 42
 */
export function MapPreview() {
  const [params] = useSearchParams()
  const which = params.get('map')
  const seedParam = params.get('seed')
  const base = import.meta.env.BASE_URL

  const tmxUrl =
    which === 'guide'
      ? `${base}textures/_pita/GuideExamples.tmx`
      : seedParam == null
      ? `${base}textures/_pita/Scenes.tmx`
      : undefined

  const seed = seedParam != null ? parseInt(seedParam, 10) || 1 : 1

  return (
    <div className="h-screen flex flex-col">
      <header className="px-4 py-2 bg-ink-900/80 border-b border-ink-700 text-sm text-ink-200 font-display flex items-center gap-3">
        <a className="text-storm-400 underline" href="#/preview">Scenes.tmx</a>
        <a className="text-storm-400 underline" href="#/preview?map=guide">GuideExamples.tmx</a>
        <a className="text-storm-400 underline" href="#/preview?seed=1">Procedural seed 1</a>
        <a className="text-storm-400 underline" href="#/preview?seed=42">seed 42</a>
        <a className="text-storm-400 underline" href="#/preview?seed=9973">seed 9973</a>
        <span className="ml-auto text-ink-300">
          {tmxUrl ? tmxUrl.split('/').pop() : `procedural seed=${seed}`}
        </span>
      </header>
      <div className="flex-1 min-h-0">
        <BeautifulMap seed={seed} width={200} height={150} tmxUrl={tmxUrl} />
      </div>
    </div>
  )
}
