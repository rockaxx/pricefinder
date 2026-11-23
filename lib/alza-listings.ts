import { load } from 'cheerio'
import { cents } from './domain'

export const alzaPs5Page =
  'https://www.alza.sk/gaming/playstation-5/18872471.htm?evt=re&exps=ps5'

type AlzaListing = {
  code: string
  productId: string
  name: string
  url: string
  priceCents: number
  currency: 'EUR'
  priceLabel: string | null
  availability: string | null
}

const normalizeText = (value: string) => value.replace(/\s+/gu, ' ').trim()

export function extractAlzaListings(html: string): AlzaListing[] {
  const $ = load(html)
  const origin = new URL(alzaPs5Page).origin
  const listings = new Map<string, AlzaListing>()
  for (const element of $('.box.browsingitem.js-box[data-code]').toArray()) {
    const card = $(element)
    const code = card.attr('data-code')
    const productId = card.attr('data-id')
    const link = card.find('a.name.browsinglink').first()
    const name = normalizeText(link.text())
    const href = link.attr('href')
    if (!code || !productId || !name || !href || listings.has(code)) continue
    let url: URL
    try {
      url = new URL(href, alzaPs5Page)
    } catch {
      continue
    }
    if (url.origin !== origin || url.username || url.password) continue

    const values = card.find('.price .js-price-box__primary-price__value')
    if (values.length !== 1) continue
    const raw = normalizeText(values.text())
    const prefix = /^(od)\s+/iu.exec(raw)?.[1]
    const amount = /^(\d[\d ]*(?:[,.]\d{1,2})?)\s*€$/u.exec(
      raw.replace(/^od\s+/iu, ''),
    )
    const priceCents = amount ? cents(amount[1].replaceAll(' ', '')) : null
    if (priceCents === null || priceCents <= 0) continue

    const title = normalizeText(
      values.closest('.ads-pb').find('[data-slot="pb-title"]').first().text(),
    )
    const availability = normalizeText(card.find('.avl .avlVal').first().text())
    listings.set(code, {
      code,
      productId,
      name,
      url: url.href,
      priceCents,
      currency: 'EUR',
      priceLabel: [title, prefix].filter(Boolean).join(' · ') || null,
      availability: availability || null,
    })
  }
  return [...listings.values()]
}
