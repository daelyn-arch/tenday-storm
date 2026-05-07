// Sanity-check world generation across many seeds.
//
// Run: `npx tsx scripts/verify-gen.ts` (from project root).
//
// Asserts the generation invariants we care about:
//   1. Desert clusters of size 2-3 don't exist (only 1-hex solos or 4+ tracts).
//   2. No two desert hexes from different clusters sit within 5 hexes
//      (solo deserts must be properly isolated).
//   3. No desert hex is adjacent to a tundra hex (hard rule).
//   4. Every tundra hex has at least one mountain neighbor.
//   5. Map perimeter (any hex with an out-of-bounds neighbor) is all ocean.
//   6. No inland coast (coast must touch ocean).
//   7. Every river starts at a mountain hex and ends at a shoreline hex
//      with its ocean-facing edge listed in the rivers array.

import { generateWorld } from '../src/world/generate'
import { NEIGHBORS, neighbors } from '../src/hex/coords'

const SEED_COUNT = 25
const SEEDS = Array.from({ length: SEED_COUNT }, (_, i) => i * 9973 + 1)
const W = 20
const H = 20

interface SeedReport {
  seed: number
  badClusters: number
  smallestBadCluster: number | null
  closeSolos: number
  tundraDesertAdj: number
  tundraNoMountain: number
  perimeterNonOcean: number
  inlandCoast: number
  badRiverEndpoints: number
  riverSourcesNotMountain: number
  riverHexes: number
  desertHexes: number
  tundraHexes: number
  missingBiomes: string[]
}

const reports: SeedReport[] = []

for (const seed of SEEDS) {
  const w = generateWorld({ name: 'verify', seed, width: W, height: H })
  const hexByKey = new Map(w.hexes.map((h) => [`${h.q},${h.r}`, h]))

  // 1. Connected desert clusters — only sizes 1 or >=4 are allowed.
  const visited = new Set<string>()
  let badClusters = 0
  let smallestBad: number | null = null
  const desertClusters: typeof w.hexes[] = []
  for (const h of w.hexes) {
    if (h.biome !== 'desert') continue
    const k = `${h.q},${h.r}`
    if (visited.has(k)) continue
    const stack = [h]
    visited.add(k)
    const cluster: typeof w.hexes = []
    while (stack.length) {
      const cur = stack.pop()!
      cluster.push(cur)
      for (const n of neighbors(cur)) {
        const nk = `${n.q},${n.r}`
        if (visited.has(nk)) continue
        const nh = hexByKey.get(nk)
        if (!nh || nh.biome !== 'desert') continue
        visited.add(nk)
        stack.push(nh)
      }
    }
    desertClusters.push(cluster)
    const size = cluster.length
    if (size >= 2 && size < 4) {
      badClusters++
      smallestBad = smallestBad == null ? size : Math.min(smallestBad, size)
    }
  }
  // 1b. Solo deserts must be at least 5 hexes from any other desert.
  let closeSolos = 0
  const solos = desertClusters.filter((c) => c.length === 1).map((c) => c[0])
  for (let i = 0; i < solos.length; i++) {
    let bad = false
    for (let j = 0; j < solos.length; j++) {
      if (i === j) continue
      const d =
        Math.abs(solos[i].q - solos[j].q) +
        Math.abs(solos[i].r - solos[j].r) +
        Math.abs(solos[i].q + solos[i].r - solos[j].q - solos[j].r)
      if (d / 2 < 5) {
        bad = true
        break
      }
    }
    if (!bad) {
      for (const other of desertClusters) {
        if (other.length === 1) continue
        for (const o of other) {
          const d =
            Math.abs(solos[i].q - o.q) +
            Math.abs(solos[i].r - o.r) +
            Math.abs(solos[i].q + solos[i].r - o.q - o.r)
          if (d / 2 < 5) {
            bad = true
            break
          }
        }
        if (bad) break
      }
    }
    if (bad) closeSolos++
  }

  // 2. Tundra-desert adjacency
  let tdAdj = 0
  for (const h of w.hexes) {
    if (h.biome !== 'tundra') continue
    for (const n of neighbors(h)) {
      const nh = hexByKey.get(`${n.q},${n.r}`)
      if (nh?.biome === 'desert') tdAdj++
    }
  }

  // 3. Tundra must have at least one mountain neighbor.
  let tundraNoMountain = 0
  for (const h of w.hexes) {
    if (h.biome !== 'tundra') continue
    const ok = neighbors(h).some((n) => hexByKey.get(`${n.q},${n.r}`)?.biome === 'mountain')
    if (!ok) tundraNoMountain++
  }

  // 4. Perimeter (any hex with an out-of-bounds neighbor) must be ocean.
  let perimeterNonOcean = 0
  for (const h of w.hexes) {
    const isPerimeter = neighbors(h).some((n) => !hexByKey.has(`${n.q},${n.r}`))
    if (isPerimeter && h.biome !== 'ocean') perimeterNonOcean++
  }

  // 5. Inland coast hexes — coast must always touch ocean.
  let inlandCoast = 0
  for (const h of w.hexes) {
    if (h.biome !== 'coast') continue
    const adj = neighbors(h).some((n) => hexByKey.get(`${n.q},${n.r}`)?.biome === 'ocean')
    if (!adj) inlandCoast++
  }

  // 7. River endpoints. Every river chain has exactly two endpoint hexes
  // (each with exactly 1 chain edge). One must be a mountain (source); the
  // other must be a shoreline land hex with an ocean-facing edge.
  let riverHexes = 0
  let badEndpoints = 0
  let riverSourcesNotMountain = 0
  for (const h of w.hexes) {
    const r = h.generated?.rivers
    if (!r || r.length === 0) continue
    riverHexes++
    let riverChainEdges = 0
    let oceanFacingEdges = 0
    for (const e of r) {
      const dir = NEIGHBORS[e]
      const nh = hexByKey.get(`${h.q + dir.q},${h.r + dir.r}`)
      if (!nh) continue
      const nr = nh.generated?.rivers
      if (nh.biome === 'ocean') oceanFacingEdges++
      else if (nr && nr.length > 0) riverChainEdges++
    }
    // Endpoint = exactly 1 chain edge.
    if (riverChainEdges === 1) {
      // Either: (a) a mountain source (0 ocean edges) OR (b) a shoreline
      // land hex with 1+ ocean edge.
      if (h.biome === 'mountain') {
        // Mountain source — fine.
      } else if (oceanFacingEdges >= 1) {
        // Shoreline destination — fine.
      } else {
        badEndpoints++
      }
    }
  }
  // Sanity: at least one river hex per chain should be a mountain. Walk all
  // river-hex components and count those without any mountain hex.
  const riverVisited = new Set<string>()
  for (const h of w.hexes) {
    if (!h.generated?.rivers || h.generated.rivers.length === 0) continue
    const k = `${h.q},${h.r}`
    if (riverVisited.has(k)) continue
    const stack = [h]
    riverVisited.add(k)
    let hasMountain = false
    while (stack.length) {
      const cur = stack.pop()!
      if (cur.biome === 'mountain') hasMountain = true
      for (const n of neighbors(cur)) {
        const nk = `${n.q},${n.r}`
        if (riverVisited.has(nk)) continue
        const nh = hexByKey.get(nk)
        if (!nh || !nh.generated?.rivers || nh.generated.rivers.length === 0) continue
        riverVisited.add(nk)
        stack.push(nh)
      }
    }
    if (!hasMountain) riverSourcesNotMountain++
  }

  // 8. Every biome appears at least once.
  const allBiomes = ['ocean', 'coast', 'plains', 'forest', 'hills', 'mountain', 'desert', 'swamp', 'tundra']
  const present = new Set(w.hexes.map((h) => h.biome))
  const missingBiomes = allBiomes.filter((b) => !present.has(b as never))

  reports.push({
    seed,
    badClusters,
    smallestBadCluster: smallestBad,
    closeSolos,
    tundraDesertAdj: tdAdj,
    tundraNoMountain,
    perimeterNonOcean,
    inlandCoast,
    badRiverEndpoints: badEndpoints,
    riverSourcesNotMountain,
    riverHexes,
    desertHexes: w.hexes.filter((h) => h.biome === 'desert').length,
    tundraHexes: w.hexes.filter((h) => h.biome === 'tundra').length,
    missingBiomes,
  })
}

const pass = reports.filter(
  (r) =>
    r.badClusters === 0 &&
    r.closeSolos === 0 &&
    r.tundraDesertAdj === 0 &&
    r.tundraNoMountain === 0 &&
    r.perimeterNonOcean === 0 &&
    r.inlandCoast === 0 &&
    r.badRiverEndpoints === 0 &&
    r.riverSourcesNotMountain === 0 &&
    r.missingBiomes.length === 0,
)
const fail = reports.filter((r) => !pass.includes(r))

const totals = reports.reduce(
  (acc, r) => {
    acc.desert += r.desertHexes
    acc.tundra += r.tundraHexes
    acc.rivers += r.riverHexes
    acc.seedsWithRivers += r.riverHexes > 0 ? 1 : 0
    acc.seedsWithDesert += r.desertHexes > 0 ? 1 : 0
    acc.seedsWithTundra += r.tundraHexes > 0 ? 1 : 0
    return acc
  },
  { desert: 0, tundra: 0, rivers: 0, seedsWithRivers: 0, seedsWithDesert: 0, seedsWithTundra: 0 },
)

console.log(`\n=== verify-gen: ${SEED_COUNT} seeds, ${W}×${H} ===\n`)
console.log(`Pass: ${pass.length}/${SEED_COUNT}   Fail: ${fail.length}/${SEED_COUNT}\n`)
console.log(`Coverage:`)
console.log(`  seeds with desert : ${totals.seedsWithDesert}/${SEED_COUNT}  (avg ${(totals.desert / SEED_COUNT).toFixed(1)} hexes)`)
console.log(`  seeds with tundra : ${totals.seedsWithTundra}/${SEED_COUNT}  (avg ${(totals.tundra / SEED_COUNT).toFixed(1)} hexes)`)
console.log(`  seeds with rivers : ${totals.seedsWithRivers}/${SEED_COUNT}  (avg ${(totals.rivers / SEED_COUNT).toFixed(1)} river hexes)`)

if (fail.length) {
  console.log(`\nFailures:`)
  for (const f of fail) {
    const reasons: string[] = []
    if (f.badClusters > 0)
      reasons.push(`${f.badClusters} desert cluster(s) of size 2-3 (smallest: ${f.smallestBadCluster})`)
    if (f.closeSolos > 0) reasons.push(`${f.closeSolos} solo desert(s) within 5 hexes of another desert`)
    if (f.tundraDesertAdj > 0) reasons.push(`${f.tundraDesertAdj} tundra-desert adjacencies`)
    if (f.tundraNoMountain > 0) reasons.push(`${f.tundraNoMountain} tundra without mountain neighbor`)
    if (f.perimeterNonOcean > 0) reasons.push(`${f.perimeterNonOcean} perimeter hex(es) not ocean`)
    if (f.inlandCoast > 0) reasons.push(`${f.inlandCoast} inland coast hex(es)`)
    if (f.badRiverEndpoints > 0) reasons.push(`${f.badRiverEndpoints} river endpoint(s) malformed`)
    if (f.riverSourcesNotMountain > 0)
      reasons.push(`${f.riverSourcesNotMountain} river chain(s) without mountain source`)
    if (f.missingBiomes.length > 0) reasons.push(`missing biomes: ${f.missingBiomes.join(', ')}`)
    console.log(`  seed ${f.seed}: ${reasons.join(', ')}`)
  }
  process.exit(1)
} else {
  console.log(`\nAll invariants hold.`)
  process.exit(0)
}
