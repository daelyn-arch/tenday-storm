import { useSearchParams } from 'react-router-dom'
import { BeautifulMap } from '../map/BeautifulMap'

/**
 * Auth-free preview of Pita's example maps. Use these to study how the
 * tileset is meant to be composed before designing the new generator.
 *
 *   /#/preview            → Scenes.tmx
 *   /#/preview?map=guide  → GuideExamples.tmx
 */
export function MapPreview() {
  const [params] = useSearchParams()
  const which = params.get('map')
  const base = import.meta.env.BASE_URL

  const tmxUrl =
    which === 'guide'
      ? `${base}textures/_pita/GuideExamples.tmx`
      : `${base}textures/_pita/Scenes.tmx`

  return (
    <div className="h-screen flex flex-col">
      <header className="px-4 py-2 bg-ink-900/80 border-b border-ink-700 text-sm text-ink-200 font-display flex items-center gap-3">
        <a className="text-storm-400 underline" href="#/preview">Scenes.tmx</a>
        <a className="text-storm-400 underline" href="#/preview?map=guide">GuideExamples.tmx</a>
        <span className="ml-auto text-ink-300">{tmxUrl.split('/').pop()}</span>
      </header>
      <div className="flex-1 min-h-0">
        <BeautifulMap tmxUrl={tmxUrl} />
      </div>
    </div>
  )
}
