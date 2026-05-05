import type { ItemRow, RegionRow } from '../types/db'
import { pick, type Rng } from './rng'

interface RumorContext {
  item: Pick<ItemRow, 'name' | 'is_real'>
  itemRegion?: RegionRow
  allRegions: RegionRow[]
}

const TRUE_TEMPLATES = [
  'A wandering pilgrim swears the {item} was sealed somewhere in {region}.',
  'Old maps from {region} mark a single rune-circle — the {item} is said to lie within.',
  'Travelers from {region} speak of a place "the storm cannot touch" — they whisper the {item} sleeps there.',
  'A drunken sage from {region} bet his life that the {item} still rests where it was sealed.',
  'Local children in {region} sing a rhyme about the {item} — one of the verses describes the path exactly.',
]

const FALSE_TEMPLATES = [
  'A merchant claims the {item} was stolen and now lies in {region}. He seemed nervous.',
  'A crumbling tome from {region} mentions a relic called the {item}, but the page has been re-inked.',
  'A bard in {region} sings of the {item} for coin, then changes the location each night.',
  'Rumor in {region} has it the {item} is real — but the same rumor names a different relic last week.',
]

const SOURCE_TEMPLATES = [
  'A traveler in {source} mentioned: {body}',
  '({source}) {body}',
  'Heard in {source}: {body}',
]

export function generateRumor(ctx: RumorContext, sourceRegion: RegionRow, rng: Rng): string {
  const tpl = ctx.item.is_real ? pick(rng, TRUE_TEMPLATES) : pick(rng, FALSE_TEMPLATES)
  const region = ctx.itemRegion?.name ?? pick(rng, ctx.allRegions).name
  const body = tpl.replace('{item}', ctx.item.name).replace('{region}', region)
  const wrapper = pick(rng, SOURCE_TEMPLATES)
  return wrapper.replace('{source}', sourceRegion.name).replace('{body}', body)
}
