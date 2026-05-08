// Walks public/textures/tiles/, extracts the diffuse JPG from any
// *_4k.blend.zip files (Poly Haven format), resizes to 512×512, names the
// result after a guessed biome, and removes source files.
//
// Usage: drop one or more *_4k.blend.zip files into public/textures/tiles/
// and run `npx tsx scripts/process-tile-textures.ts`.

import { execSync } from 'node:child_process'
import { readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const TILES_DIR = 'public/textures/tiles'

// Map common Poly Haven texture names to our biome filenames.
const BIOME_MAP: Record<string, string> = {
  beach: 'coast',
  sand: 'desert',
  snow: 'tundra',
  ice: 'tundra',
  grass: 'plains',
  field: 'plains',
  meadow: 'plains',
  forest: 'forest',
  leaves: 'forest',
  moss: 'forest',
  swamp: 'swamp',
  mud: 'swamp',
  rock: 'mountain',
  stone: 'mountain',
  cliff: 'mountain',
  mountain: 'mountain',
  hill: 'hills',
  water: 'ocean',
  ocean: 'ocean',
}

function guessBiome(zipName: string): string {
  const lower = zipName.toLowerCase()
  for (const [keyword, biome] of Object.entries(BIOME_MAP)) {
    if (lower.includes(keyword)) return biome
  }
  // Fallback: strip trailing _01_4k.blend.zip etc.
  return lower.replace(/_(?:0\d|4k|\d+k)+|\.blend\.zip$|\.zip$/g, '').trim() || 'unknown'
}

const entries = readdirSync(TILES_DIR).filter((f) => f.endsWith('.zip'))
if (!entries.length) {
  console.log('No .zip files in', TILES_DIR)
  process.exit(0)
}

for (const zip of entries) {
  const biome = guessBiome(zip)
  const zipPath = join(TILES_DIR, zip)
  console.log(`\n→ ${zip}  →  ${biome}.jpg`)
  // Use forward slashes for the shell — unzip on Windows + Git Bash chokes
  // on backslashes inside quotes.
  const fwd = (p: string) => p.replace(/\\/g, '/')
  const tmpName = `__extract_${Date.now()}.jpg`
  const tmpPath = join(TILES_DIR, tmpName)
  // Run from the tiles directory so we don't have to deal with the path
  // quoting at all.
  // Diffuse JPG lives at "textures/<name>_diff_<res>.jpg" inside the zip.
  execSync(`cd "${fwd(TILES_DIR)}" && unzip -p "${zip}" "textures/*diff*.jpg" > "${tmpName}"`, {
    stdio: 'inherit',
    shell: 'bash',
  })
  if (!statSync(tmpPath).size) {
    console.warn(`  (no diffuse jpg found, skipping)`)
    rmSync(tmpPath)
    continue
  }
  const outPath = join(TILES_DIR, `${biome}.jpg`)
  execSync(
    `npx --yes sharp-cli --input "${fwd(tmpPath)}" --output "${fwd(outPath)}" resize 512 512 --fit cover`,
    { stdio: 'inherit', shell: 'bash' },
  )
  rmSync(tmpPath)
  rmSync(zipPath)
  console.log(`  saved ${outPath}`)
}

console.log('\nDone.')
