import { normalize, relevance } from './domain'
import { isWantedListing } from './listing-intent'

const ps5 = /\bplay\s*station\s*5\b/

const kinds = {
  game: /\b(?:hr[ayue]|hier|her|videohry|games?|steelbook)\b/g,
  controller: /\b(?:ovladac\w*|dualsense|gamepad\w*|joystick\w*|controllers?|volant\w*)\b/g,
  accessory: /\b(?:prislusenstv\w*|stojan\w*|drziak\w*|drzak\w*|dokov\w*|docks?|nabij\w*|dobij\w*|charger\w*|obal\w*|puzdr\w*|pouzd\w*|covers?|sleeves?|kryt\w*|batoh\w*|kabel\w*|sluchadl\w*|headset\w*|ventilator\w*|adapter\w*|krabic\w*|nalepk\w*|sklo|foli\w*|ochran\w*|portal|vr2|mechanik\w*|disk\w*|wallet|penazen\w*|store|kod\w*|gift\s+card)\b/g,
}
type Kind = keyof typeof kinds

const consoleWords = /\b(?:herna\s+)?konzol(?:a|u|y|ou|e)?\b/
const consolePrefix = /^(?:(?:predam|predaj|ponukam|sony|herna|konzola|konzolu|nova|novu|novy|uplne|pouzita|predavam|zabalena|zabalenu|original)\s+)*$/
const consoleLead = /^(?:predam\s+|predaj\s+|ponukam\s+|nov[aue]\s+|zabalen[aue]\s+|pouzit[aue]\s+|(?:herna\s+)?konzol[auy]\s+|sony\s+)*/
const consoleSpecs = /^(?:(?:slim|pro|digital|disc|edition|edicia|fat|standard|chassis|verzia|typ|modelu|[ab]|eas|cf[i1][a-z0-9]*|ps\d+|\d+(?:gb|tb)?)\b\s*)+/
const consoleDetail = /^(?:s\s+(?:(?:diskovou|blu\s+ray)\s+)?mechanikou|s\s+ovladac\w*|bez\s+mechaniky|s\s+diskom|diskova\s+verzia|biel[ay]|cier[n]+[ay]|nov[aey]|pouzit[aey]|used|rezervovan\w*|top\s+stav|zaruka|eu\s+distribu\w*|limitovan\w*\s+edici\w*)\b/
const bundle = /\s*[+＆&]\s*|\s+(?:vratane|vcetne|spolu\s+s)\s+/i

function kindMarkers(value: string): Kind[] {
  return (Object.keys(kinds) as Kind[]).filter((kind) => value.match(kinds[kind]))
}

export function classifyPs5(title: string, link: string): Kind | 'console' | 'unknown' {
  const primary = normalize(title.split(bundle, 1)[0])
  const model = ps5.exec(primary)
  const tags = kindMarkers(primary)
  if (model) {
    const before = primary.slice(0, model.index)
    const after = primary.slice(model.index + model[0].length).trim()
    // A console can include a drive, a controller or a game. A drive for a console is a separate item.
    const modifiers = after.replace(/\bs\s+(?:(?:diskovou|blu\s+ray)\s+)?(?:mechanikou|ovladacom|diskom)\b|\bbez\s+mechaniky\b|\bdiskova\s+verzia\b/g, '')
    if (consolePrefix.test(before) && !kindMarkers(modifiers).length) {
      const remainder = after.replace(consoleSpecs, '')
      if (!remainder || consoleWords.test(before) || consoleDetail.test(remainder))
        return 'console'
    }
  }
  if (tags.includes('accessory')) return 'accessory'
  if (tags.length) return tags[0]
  if (/\b(?:herna konzola|cfi\d{4}[ab]?)\b/.test(primary) && (model || ps5.test(link)))
    return 'console'
  // A platform in a game's title or URL is compatibility. Standalone PS5 must be a console.
  if (ps5.test(normalize(title)) || ps5.test(link)) return 'game'
  return 'unknown'
}

export function productRelevance(query: string) {
  const normalizedQuery = normalize(query)
  const model = ps5.exec(normalizedQuery)
  if (!model) {
    const searchesAccessory = kindMarkers(normalizedQuery).length > 0
    return (title: string) => {
      const score = relevance(query, title)
      if (!score || searchesAccessory) return score
      const [item, compatibility] = normalize(title).split(/\b(?:pre|pro|for|kompatibiln\w* s)\s+/, 2)
      const compatibleAccessory = compatibility && kindMarkers(item).length &&
        relevance(query, compatibility) && !relevance(query, item)
      return compatibleAccessory ? 0 : score
    }
  }

  const qualifiers = normalizedQuery.replace(ps5, '').replace(consoleLead, '').trim()
  const requestedKinds = kindMarkers(qualifiers)
  const explicitlyConsole = consoleWords.test(normalizedQuery) ||
    /\b(?:s|bez)\s+(?:(?:diskovou|diskovej)\s+)?mechanik\w*\b/.test(qualifiers)
  const consoleQuery = explicitlyConsole || (
    !requestedKinds.length &&
    /^(?:(?:slim|pro|digital|disc|edition|edicia|fat|standard|sony|[\d]+(?:gb|tb)|cf[i1][a-z0-9]+)\s*)*$/.test(qualifiers)
  )
  const accessoryGroup = /\bprislusenstv\w*\b/.test(qualifiers)
  let subject = qualifiers.replace(kinds.game, ' ')
  if (!requestedKinds.includes('accessory')) subject = subject.replace(kinds.controller, ' ')
  if (accessoryGroup) subject = subject.replace(/\bprislusenstv\w*\b/, ' ')
  subject = subject.replace(/\b(?:na|pre|pro|for|do|s)\b/g, ' ').trim()

  return (title: string, url = '') => {
    const normalizedTitle = normalize(title)
    if (isWantedListing(title)) return 0
    const link = normalize(url.split(/[?#]/, 1)[0])
    const hasModel = ps5.test(normalizedTitle) || ps5.test(link)
    const kind = classifyPs5(title, link)
    if (consoleQuery) {
      if (kind !== 'console') return 0
      const variant = qualifiers.match(/\b(?:slim|pro|digital|disc|fat|\d+(?:gb|tb)|cfi[a-z0-9]+)\b/g) ?? []
      const primary = normalize(title.split(bundle, 1)[0])
      if (variant.some((word) => !primary.split(' ').includes(word))) return 0
      if (/\bbez\s+(?:diskovej\s+)?mechaniky\b/.test(qualifiers) && !/\b(?:digital|bez mechaniky)\b/.test(primary)) return 0
      if (/\bs\s+(?:diskovou\s+)?mechanikou\b/.test(qualifiers) && !/\b(?:disc|s (?:diskovou |blu ray )?mechanikou)\b/.test(primary)) return 0
      return relevance(query, title) || 1
    }
    if (kind === 'console') return 0
    const isDualSense = kind === 'controller' && /\bdualsense\b/.test(normalizedTitle)
    if (!hasModel && !isDualSense) return 0
    if (requestedKinds.length) {
      const requestedKind = requestedKinds.includes('accessory') ? 'accessory' : requestedKinds[0]
      if (requestedKind !== kind && !(accessoryGroup && kind === 'controller')) return 0
      if (/\bdualsense\b/.test(qualifiers) && !isDualSense) return 0
      return relevance(subject, normalizedTitle)
    }
    return relevance(qualifiers, normalizedTitle)
  }
}

export function sourceSearchQuery(query: string) {
  return normalize(query).replace(ps5, 'playstation 5') === 'playstation 5'
    ? 'playstation 5'
    : query
}
