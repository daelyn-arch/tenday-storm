import { useState } from 'react'
import { BeautifulMap } from '../map/BeautifulMap'
import { ELEMENT_TYPES, type ElementType } from '../map/elements'

const ELEMENT_LABELS: Record<ElementType, string> = {
  plains: 'Plains',
  forest: 'Forest',
  hills: 'Hills',
  mountain_range: 'Mountain Range',
  mountain_peak: 'Mountain Peak',
  island_small: 'Small Island',
  island_medium: 'Medium Island',
  lake: 'Lake',
  beach: 'Beach',
  castle: 'Castle',
  fortress: 'Fortress',
  walled_city: 'Walled City',
  village: 'Village',
  watchtower: 'Watchtower',
  cabin: 'Cabin',
}

function newSeed() {
  return Math.floor(Math.random() * 0xffffffff)
}

/**
 * Element gallery — render each terrain piece in isolation so you can
 * iterate on its rendering before composing full maps. Pick a type from
 * the sidebar, then shuffle for variations of just that piece.
 */
export function ElementsLab() {
  const [type, setType] = useState<ElementType>('forest')
  const [seed, setSeed] = useState(() => newSeed())

  return (
    <div className="h-screen flex flex-col bg-ink-900">
      <header className="px-4 py-2 bg-ink-900/80 border-b border-ink-700 text-sm text-ink-200 font-display flex items-center gap-3 flex-wrap">
        <span className="text-ink-100">Element Lab</span>
        <span className="text-ink-400">|</span>
        <span className="text-ink-300">{ELEMENT_LABELS[type]}</span>
        <button className="btn text-xs py-1 px-2 ml-2" onClick={() => setSeed(newSeed())}>
          ↻ shuffle
        </button>
        <span className="ml-auto text-ink-300 text-xs">seed {seed}</span>
      </header>
      <div className="flex-1 grid grid-cols-[200px_1fr] min-h-0">
        <aside className="border-r border-ink-700 p-2 overflow-y-auto">
          <ul className="space-y-0.5 text-sm">
            {ELEMENT_TYPES.map((t) => (
              <li key={t}>
                <button
                  className={`w-full text-left px-2 py-1 rounded ${
                    type === t
                      ? 'bg-storm-700/60 text-ink-50'
                      : 'text-ink-300 hover:text-ink-100 hover:bg-ink-800'
                  }`}
                  onClick={() => {
                    setType(t)
                    setSeed(newSeed())
                  }}
                >
                  {ELEMENT_LABELS[t]}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main className="relative min-h-0">
          <BeautifulMap element={{ type, seed }} />
        </main>
      </div>
    </div>
  )
}
