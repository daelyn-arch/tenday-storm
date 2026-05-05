import { pick, type Rng } from './rng'

const PREFIX = [
  'Ael', 'Aer', 'Bal', 'Brae', 'Cal', 'Car', 'Cor', 'Dor', 'Dun', 'El',
  'Fal', 'Gal', 'Gor', 'Hal', 'Har', 'Iss', 'Kal', 'Kor', 'Lor', 'Mal',
  'Mor', 'Nor', 'Oss', 'Phar', 'Quel', 'Ral', 'Sal', 'Tar', 'Thal', 'Ul',
  'Val', 'Var', 'Wyn', 'Xan', 'Yor', 'Zel',
]
const MID = ['', 'an', 'en', 'in', 'on', 'un', 'ar', 'or', 'el', 'is', 'os']
const SUFFIX = [
  'mark', 'land', 'reach', 'wold', 'gard', 'heim', 'lyn', 'fell', 'shire',
  'bend', 'crest', 'thar', 'ros', 'dor', 'wyck', 'march', 'spire',
]

const ITEM_NAMES = [
  'Sunfire Crown',
  'Tide-Bound Aegis',
  'Wraithsong Lyre',
  'Ironclasp Gauntlet',
  'Worldroot Staff',
  'Whisperveil Cloak',
  'Stormcaller Horn',
  'Embergrave Blade',
  'Pale Auger',
  'Heart of the First Tree',
  'Saltburn Chalice',
  'Vow-Iron Circlet',
  'Mourning Lantern',
  'Bone-Reading Tome',
  'Gilded Lamentation',
  'Cinderhowl Greataxe',
]

const FAKE_ITEM_NAMES = [
  'False Crown of Ash',
  'Drunkard\'s Promise',
  'Beggar-King\'s Locket',
  'Hollow Verse',
  'Tongueless Bell',
  'Penitent\'s Glass',
  'Forgotten Reliquary',
]

export function regionName(rng: Rng): string {
  const a = pick(rng, PREFIX)
  const b = pick(rng, MID)
  const c = pick(rng, SUFFIX)
  return `${a}${b}${c}`
}

export function realItemName(rng: Rng): string {
  return pick(rng, ITEM_NAMES)
}

export function fakeItemName(rng: Rng): string {
  return pick(rng, FAKE_ITEM_NAMES)
}
