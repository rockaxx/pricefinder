import { normalize } from './domain'

const greeting = /^(?:(?:dobry den|zdravim|ahoj(?:te)?|nazdar)\b\s*)+/
const forSale = /^(?:predam|predavam|ponukam|na predaj|for sale|selling)\b/
const wanted = /^(?:kupim|kupujem|vykupim|chcem kupit|mam zaujem o kupu|dopyt|zhanam|shanim|wtb|want to buy|hladam(?!\s+(?:(?:noveho\s+)?majitela|kupcu|zaujemcu)\b))\b/

const statement = (text: string) => normalize(text).replace(greeting, '')
const statements = (description: string) => description.split(/[.!?\r\n]+/, 4).map(statement)

export function hasExplicitSale(title: string, description = '') {
  return [statement(title), ...statements(description)].some((text) =>
    forSale.test(text) || /^hladam\s+(?:noveho\s+)?(?:majitela|kupcu)\b/.test(text),
  )
}

export function isWantedListing(title: string, description = '') {
  if (hasExplicitSale(title, description)) return false
  return [statement(title), ...statements(description)].some((text) => wanted.test(text))
}
