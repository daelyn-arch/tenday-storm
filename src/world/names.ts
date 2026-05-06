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

export function regionName(rng: Rng): string {
  const a = pick(rng, PREFIX)
  const b = pick(rng, MID)
  const c = pick(rng, SUFFIX)
  return `${a}${b}${c}`
}
