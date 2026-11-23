import { load } from 'cheerio'
import { cents } from './domain'
import { extractAlzaListings } from './alza-listings'

export type LocalListing = {
  id: string
  name: string
  priceCents: number
  url: string
  image: string | null
  priceLabel?: string | null
}

export function providerSearchLinks(query: string) {
  const bazos = new URL('/search.php', 'https://www.bazos.sk')
  bazos.search = new URLSearchParams({
    hledat: query,
    rubriky: 'www',
    hlokalita: '',
    humkreis: '25',
    cenaod: '',
    cenado: '',
    order: '',
    kitx: 'ano',
  }).toString()
  return [
    { name: 'Bazoš.sk', url: bazos.href },
  ]
}

export function listingPhoto(value: unknown, provider: 'alza' | 'bazos') {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    const allowed =
      provider === 'alza'
        ? ['image.alza.cz', 'image.alza.sk', 'cdn.alza.sk'].includes(
            url.hostname,
          )
        : ['www.bazos.sk', 'bazos.sk'].includes(url.hostname) &&
          url.pathname.startsWith('/img/')
    return allowed &&
      url.protocol === 'https:' &&
      !url.port &&
      !url.username &&
      !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}
export function extractBazosListings(html: string): LocalListing[] {
  const $ = load(html.replace(/\\([<>.:-])/g, '$1'))
  const rows = new Map<string, LocalListing>()
  for (const element of $('.inzeraty.inzeratyflex').toArray()) {
    const card = $(element)
    const title = card.find('h2.nadpis > a').first()
    const name = title.text().replace(/\s+/gu, ' ').trim()
    const href = title.attr('href')
    if (!name || !href) continue
    let url: URL
    try {
      url = new URL(href, 'https://www.bazos.sk')
    } catch {
      continue
    }
    const id = /^\/inzerat\/(\d+)\/[^/]+\.php$/i.exec(url.pathname)?.[1]
    if (
      !id ||
      rows.has(id) ||
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password ||
      !/^(?:[a-z0-9-]+\.)?bazos\.sk$/i.test(url.hostname)
    )
      continue
    const amount = /^(\d[\d ]*(?:[,.]\d{1,2})?)\s*€$/u.exec(
      card.find('.inzeratycena').first().text().replace(/\s+/gu, ' ').trim(),
    )
    const priceCents = amount ? cents(amount[1].replaceAll(' ', '')) : null
    if (priceCents === null) continue
    url.search = ''
    url.hash = ''
    rows.set(id, {
      id,
      name,
      priceCents,
      url: url.href,
      image: listingPhoto(
        card.find('.inzeratynadpis img.obrazek').first().attr('src'),
        'bazos',
      ),
    })
  }
  return [...rows.values()]
}

export function extractLocalAlzaListings(html: string): LocalListing[] {
  const $ = load(html)
  const photos = new Map(
    $('.box.browsingitem.js-box[data-code]')
      .toArray()
      .map((element) => {
        const card = $(element)
        return [
          card.attr('data-code'),
          listingPhoto(
            card.find('img.js-box-image').first().attr('src'),
            'alza',
          ),
        ] as const
      }),
  )
  return extractAlzaListings(html).map((row) => ({
    id: row.code,
    name: row.name,
    priceCents: row.priceCents,
    url: row.url,
    image: photos.get(row.code) ?? null,
    priceLabel: row.priceLabel,
  }))
}
