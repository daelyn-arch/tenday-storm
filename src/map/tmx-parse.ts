// Shared Pita-TMX parser. Outputs a multi-layer tile grid with tile gids
// (1-indexed; subtract 1 to get a 0-indexed atlas position).

export interface ParsedLayer {
  name: string
  tiles: number[]
}

export interface ParsedTmx {
  width: number
  height: number
  layers: ParsedLayer[]
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`)
  return r.text()
}

export async function parseTmx(url: string): Promise<ParsedTmx> {
  const xml = await fetchText(url)
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const map = doc.querySelector('map')
  if (!map) throw new Error('TMX has no <map>')
  const width = parseInt(map.getAttribute('width') ?? '0', 10)
  const height = parseInt(map.getAttribute('height') ?? '0', 10)
  const layers: ParsedLayer[] = []
  for (const layer of Array.from(doc.querySelectorAll('layer'))) {
    const name = layer.getAttribute('name') ?? ''
    const data = layer.querySelector('data')
    if (!data) continue
    const text = data.textContent ?? ''
    const tiles = text
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => parseInt(s, 10) || 0)
    layers.push({ name, tiles })
  }
  return { width, height, layers }
}
