import { useEffect, useState } from 'react'
import { BeautifulMap } from '../map/BeautifulMap'

interface SeedNote {
  seed: number
  liked: boolean
  ts: number
}

const STORAGE_KEY = 'tenday-storm.map-lab'

function loadHistory(): SeedNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveHistory(notes: SeedNote[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch {
    // ignore
  }
}

function newSeed(): number {
  return Math.floor(Math.random() * 0xffffffff)
}

/**
 * Generator Lab — no-auth route where you click through small generated
 * maps and rate them. Liked seeds persist to localStorage so you can come
 * back to them later for the stitching pass.
 */
export function MapLab() {
  const [seed, setSeed] = useState<number>(() => newSeed())
  const [history, setHistory] = useState<SeedNote[]>(() => loadHistory())
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 50, h: 40 })

  useEffect(() => {
    saveHistory(history)
  }, [history])

  const liked = history.filter((n) => n.liked)
  const disliked = history.filter((n) => !n.liked)

  function record(like: boolean) {
    setHistory((h) => [{ seed, liked: like, ts: Date.now() }, ...h])
    setSeed(newSeed())
  }

  function loadSeed(s: number) {
    setSeed(s)
  }

  return (
    <div className="h-screen flex flex-col bg-ink-900">
      <header className="px-4 py-2 bg-ink-900/80 border-b border-ink-700 text-sm text-ink-200 font-display flex items-center gap-3 flex-wrap">
        <span className="text-ink-100">Map Lab</span>
        <span className="text-ink-400">|</span>
        <button
          className="btn text-xs py-1 px-2"
          onClick={() => record(true)}
          title="Save this seed to liked maps"
        >
          👍 like (l)
        </button>
        <button
          className="btn text-xs py-1 px-2"
          onClick={() => record(false)}
          title="Skip this seed"
        >
          👎 dislike (d)
        </button>
        <button
          className="btn text-xs py-1 px-2"
          onClick={() => setSeed(newSeed())}
        >
          ↻ shuffle (space)
        </button>
        <span className="text-ink-400">|</span>
        <label className="text-xs">
          size{' '}
          <input
            className="input w-16 inline-block"
            type="number"
            min={20}
            max={100}
            value={size.w}
            onChange={(e) => setSize({ ...size, w: parseInt(e.target.value, 10) || 50 })}
          />{' '}
          ×{' '}
          <input
            className="input w-16 inline-block"
            type="number"
            min={20}
            max={100}
            value={size.h}
            onChange={(e) => setSize({ ...size, h: parseInt(e.target.value, 10) || 40 })}
          />
        </label>
        <span className="ml-auto text-ink-300">
          seed {seed} · liked {liked.length} · disliked {disliked.length}
        </span>
      </header>

      <div className="flex-1 grid grid-cols-[1fr_280px] min-h-0">
        <div
          className="relative min-h-0"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'l') record(true)
            else if (e.key === 'd') record(false)
            else if (e.key === ' ') {
              e.preventDefault()
              setSeed(newSeed())
            }
          }}
        >
          <BeautifulMap poi={{ width: size.w, height: size.h, seed }} />
        </div>
        <aside className="border-l border-ink-700 p-3 text-sm text-ink-200 overflow-y-auto">
          <div className="font-display text-base mb-2">Liked seeds</div>
          {liked.length === 0 && <div className="text-ink-400 text-xs italic">none yet</div>}
          <ul className="space-y-1">
            {liked.slice(0, 20).map((n) => (
              <li key={n.ts} className="flex items-center justify-between">
                <button
                  className="text-storm-400 underline text-xs font-mono"
                  onClick={() => loadSeed(n.seed)}
                >
                  {n.seed}
                </button>
                <button
                  className="text-ink-400 hover:text-red-400 text-xs"
                  onClick={() => setHistory((h) => h.filter((x) => x.ts !== n.ts))}
                  title="Remove"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {liked.length > 0 && (
            <button
              className="btn btn-danger text-xs py-1 px-2 mt-3"
              onClick={() => setHistory([])}
            >
              Clear all
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}
