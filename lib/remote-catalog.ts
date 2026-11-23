import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { load } from 'cheerio'
import { z } from 'zod'
import { cents } from './domain'
import { readCatalogUrl, sourceUrl } from './catalog-http'
import { safeUrl, type Connector } from './importer'

const urlText = z.string().min(1).max(2048)
export const merchantSyncConfig = z.discriminatedUnion('mode', [
  z.strictObject({
    authorized: z.literal(true),
    mode: z.literal('feed'),
    format: z.enum(['xml', 'csv']),
    url: urlText,
  }),
  z.strictObject({
    authorized: z.literal(true),
    mode: z.literal('pages'),
    urls: z.array(urlText).min(1).max(20),
    includeImages: z.boolean().default(false),
  }),
])
type Config = z.infer<typeof merchantSyncConfig>
type Fields = Record<string, unknown>
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const fields = (value: unknown): Fields =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Fields)
    : {}
const values = (value: unknown) => (Array.isArray(value) ? value : [value])
const term = (value: unknown) =>
  text(value).replace(/^https?:\/\/schema\.org\//, '')
const hasType = (node: Fields, type: string) =>
  values(node['@type']).some((value) => term(value) === type)

function listingFromPage(html: string, url: URL, includeImages: boolean) {
  const $ = load(html)
  const nodes: Fields[] = []
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    try {
      const root: unknown = JSON.parse($(script).text())
      for (const entry of values(root)) {
        const node = fields(entry)
        nodes.push(node, ...values(node['@graph']).map(fields))
      }
    } catch {
      continue
    }
  }

  const products = nodes.filter((node) => hasType(node, 'Product'))
  const matching = products.filter((p) => {
    const links = [
      p.url,
      p['@id'],
      ...values(p.offers).map((o) => fields(o).url),
    ]
    return links.some(
      (link) =>
        text(link) === url.href ||
        (text(link).startsWith('/') &&
          new URL(text(link), url).href === url.href),
    )
  })
  const candidates = matching.length
    ? matching
    : products.length === 1
      ? products
      : []
  const product = candidates.length === 1 ? candidates[0] : undefined
  const offers = values(product?.offers)
  const offer = fields(offers[0])
  const price =
    typeof offer.price === 'number' ? String(offer.price) : text(offer.price)
  const name = text(product?.name)
  const statedUrl = text(offer.url) || text(product?.url)
  let consistentUrl = !statedUrl
  try {
    const stated = new URL(statedUrl, url)
    consistentUrl ||= stated.href === url.href
  } catch {
    consistentUrl = false
  }
  if (
    !product ||
    offers.length !== 1 ||
    !hasType(offer, 'Offer') ||
    offer.priceCurrency !== 'EUR' ||
    (cents(price) ?? 0) <= 0 ||
    !name ||
    !consistentUrl
  ) {
    throw Error(
      'Produktová stránka nemá jednoznačnú ponuku v EUR pre zadaný produkt.',
    )
  }

  const sku = text(product.sku)
  const stableId =
    sku && sku.length <= 190
      ? sku
      : createHash('sha256').update(url.href).digest('hex')
  const availability = term(offer.availability)
  const condition = term(offer.itemCondition ?? product.itemCondition)
  const gtin =
    [
      product.gtin,
      product.gtin14,
      product.gtin13,
      product.gtin12,
      product.gtin8,
    ]
      .map(text)
      .find(Boolean) ?? ''
  const image = values(product.image)[0]
  return {
    ITEM_ID: 'page:' + stableId,
    PRODUCTNAME: name,
    MANUFACTURER: text(product.brand) || text(fields(product.brand).name),
    URL: url.href,
    PRICE_VAT: price,
    AVAILABILITY: ['InStock', 'LimitedAvailability', 'OnlineOnly'].includes(
      availability,
    )
      ? 'in'
      : ['OutOfStock', 'SoldOut', 'Discontinued', 'InStoreOnly'].includes(
            availability,
          )
        ? 'out'
        : ['PreOrder', 'BackOrder', 'PreSale'].includes(availability)
          ? 'order'
          : 'unknown',
    CONDITION: [
      'UsedCondition',
      'RefurbishedCondition',
      'DamagedCondition',
    ].includes(condition)
      ? 'used'
      : 'new',
    EAN: gtin,
    CATEGORYTEXT: text(product.category),
    IMGURL: includeImages
      ? (safeUrl(text(image) || text(fields(image).url)) ?? '')
      : '',
  }
}

function csv(rows: Record<string, string>[]) {
  const headers = Object.keys(rows[0])
  const escape = (value: string) => '"' + value.replaceAll('"', '""') + '"'
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => escape(row[key])).join(',')),
  ].join('\n')
}

export function connectorFor(
  config: Config,
  merchantHost: string,
  read = readCatalogUrl,
): Connector {
  if (config.mode === 'feed') {
    const url = sourceUrl(config.url)
    return {
      format: config.format,
      snapshot: true,
      read: () =>
        read(
          url,
          config.format === 'xml'
            ? 'application/xml,text/xml'
            : 'text/csv,text/plain',
        ),
    }
  }

  const urls = config.urls.map((url) => sourceUrl(url, merchantHost))
  if (new Set(urls.map((url) => url.href)).size !== urls.length)
    throw Error('Produktová adresa sa v zdroji opakuje.')
  return {
    format: 'csv',
    snapshot: false,
    async read() {
      const listings: Record<string, string>[] = []
      for (const [index, url] of urls.entries()) {
        if (index > 0) await delay(1000)
        const html = await read(url, 'text/html,application/xhtml+xml')
        listings.push(listingFromPage(html, url, config.includeImages))
      }
      return csv(listings)
    },
  }
}
