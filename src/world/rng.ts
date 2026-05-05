// Tiny seeded RNG (mulberry32). Deterministic for a given seed.
export function makeRng(seed: number) {
  let s = seed >>> 0
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = ReturnType<typeof makeRng>

export function randInt(rng: Rng, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function pick<T>(rng: Rng, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
