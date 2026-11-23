import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { parse } from 'csv-parse/sync'
import { z } from 'zod'
import { db } from './db'
import { cents, match } from './domain'

export interface Connector {
  read(): Promise<string>
  format: 'xml' | 'csv'
  snapshot?: boolean
}
export const sampleMarketplace: Connector = {
  format: 'csv',
  async read() {
    return 'ITEM_ID,PRODUCTNAME,MANUFACTURER,URL,PRICE_VAT,SHIPPING,CONDITION,AVAILABILITY,SELLER_TYPE,LOCATION\nused-1,Sony PlayStation 5 Slim Disc 1 TB,Sony,https://example.com/listing/ps5,329.00,4.99,used,in,private,Bratislava'
  },
}
export const sampleXml =
  '<SHOP><SHOPITEM><ITEM_ID>ps5-disc</ITEM_ID><PRODUCTNAME>Sony PlayStation 5 Slim Disc 1 TB</PRODUCTNAME><MANUFACTURER>Sony</MANUFACTURER><URL>https://example.com/product/ps5</URL><PRICE_VAT>459.00</PRICE_VAT><DELIVERY_DATE>0</DELIVERY_DATE><DELIVERY><DELIVERY_PRICE>4.99</DELIVERY_PRICE></DELIVERY></SHOPITEM></SHOP>'
const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
export function safeUrl(raw: string, host?: string | null) {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname.includes('.') &&
      /[a-z]/i.test(url.hostname.split('.').at(-1) ?? '') &&
      !/\.(local|localhost|internal|test)$/.test(url.hostname) &&
      (!host || url.hostname === host)
      ? url.href
      : null
  } catch {
    return null
  }
}
const schema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(2).max(400),
  price: z.number().int().positive(),
  url: z.string().min(1),
})
export function parseFeed(
  body: string,
  format: 'xml' | 'csv',
  host?: string | null,
  demo = false,
) {
  if (Buffer.byteLength(body) > 1_000_000)
    throw Error('Súbor môže mať najviac 1 MB.')
  let items: Record<string, unknown>[]
  if (format === 'xml') {
    if (
      /<!\s*(DOCTYPE|ENTITY)/i.test(body) ||
      XMLValidator.validate(body) !== true
    )
      throw Error('Neplatné alebo nepovolené XML.')
    const root = new XMLParser({
      parseTagValue: false,
      // The validator above rejects DTDs. Decode standard XML escapes in product links.
      processEntities: true,
      isArray: (n) => n === 'SHOPITEM' || n === 'DELIVERY',
    }).parse(body)
    items = root?.SHOP?.SHOPITEM ?? []
  } else
    items = parse(body, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      max_record_size: 10000,
    })
  if (!Array.isArray(items) || !items.length || items.length > 2000)
    throw Error('Import musí obsahovať 1 až 2 000 položiek.')
  const seen = new Set<string>()
  return items.map((r, index) => {
    const id = str(r.ITEM_ID)
    const name = str(r.PRODUCTNAME) || str(r.PRODUCT)
    const url = safeUrl(str(r.URL), host)
    const price = cents(str(r.PRICE_VAT))
    const currency = str(r.PRICE_CURRENCY || r.CURRENCY).toUpperCase()
    if (currency && currency !== 'EUR')
      throw Error('Cena položky č. ' + (index + 1) + ' musí byť v EUR.')
    const gtin = str(r.EAN)
    const direct = cents(str(r.SHIPPING))
    const rates = (Array.isArray(r.DELIVERY) ? r.DELIVERY : [])
      .map((d) => cents(str(d?.DELIVERY_PRICE)))
      .filter((n): n is number => n !== null)
    const state = str(r.AVAILABILITY).toLowerCase()
    const delay = str(r.DELIVERY_DATE)
    const availability = ['in', 'out', 'order', 'unknown'].includes(state)
      ? state
      : delay === '0'
        ? 'in'
        : delay
          ? 'order'
          : 'unknown'
    if (
      !schema.safeParse({ id, name, url, price }).success ||
      !url ||
      price === null ||
      seen.has(id) ||
      (!demo && !host)
    )
      throw Error('Neplatná alebo duplicitná položka č. ' + (index + 1) + '.')
    seen.add(id)
    return {
      id,
      name,
      url,
      price,
      shipping: direct ?? (rates.length ? Math.min(...rates) : null),
      brand: str(r.MANUFACTURER).slice(0, 150),
      gtin: /^\d{8,14}$/.test(gtin) ? gtin : null,
      condition: /^(used|použité)$/i.test(str(r.CONDITION || r.ITEM_TYPE))
        ? 'used'
        : 'new',
      availability,
      category: str(r.CATEGORYTEXT).slice(0, 400),
      image: safeUrl(str(r.IMGURL)),
      model: str(r.MODEL).slice(0, 150),
      variant: str(r.VARIANT).slice(0, 150),
      storage: str(r.STORAGE).slice(0, 100),
      sellerType: ['business', 'private'].includes(str(r.SELLER_TYPE))
        ? str(r.SELLER_TYPE)
        : null,
      location: str(r.LOCATION).slice(0, 150) || null,
      listedAt: z.iso.datetime({ offset: true }).safeParse(str(r.LISTED_AT))
        .success
        ? new Date(str(r.LISTED_AT))
        : null,
    }
  })
}
export async function importFeed(sourceId: string, connector: Connector) {
  const source = await db.dataSource.findUnique({
    where: { id: sourceId },
    include: { merchant: true },
  })
  if (
    !source?.enabled ||
    !source.merchant ||
    !['xml', 'csv', 'marketplace'].includes(source.kind)
  )
    throw Error('Zdroj nie je povolený.')
  const job = await db.importJob.create({
    data: { sourceId, status: 'running' },
  })
  try {
    const rows = parseFeed(
      await connector.read(),
      connector.format,
      source.merchant.host,
      source.demo,
    )
    await db.$transaction(
      async (tx) => {
        const products = await tx.product.findMany({
          where: { demo: source.demo },
        })
        const updatedAt = new Date()
        for (const row of rows) {
          const key = { sourceId, externalId: row.id }
          const previous = await tx.offer.findUnique({
            where: { sourceId_externalId: key },
          })
          const found = match(row, products)
          const {
            price,
            shipping,
            url,
            condition,
            availability,
            sellerType,
            location,
            listedAt,
          } = row
          const data = {
            price,
            shipping,
            url,
            condition,
            availability,
            sellerType,
            location,
            listedAt,
            merchantId: source.merchantId!,
            title: row.name,
            updatedAt,
            productId: previous?.reviewed ? previous.productId : found.id,
            confidence: previous?.reviewed ? 100 : found.confidence,
            listing: {
              brand: row.brand,
              gtin: row.gtin,
              category: row.category,
              image: row.image,
              model: row.model,
              variant: row.variant,
              storage: row.storage,
            },
          }
          const offer = await tx.offer.upsert({
            where: { sourceId_externalId: key },
            create: { ...key, ...data },
            update: data,
          })
          const latest = await tx.priceHistory.findFirst({
            where: { offerId: offer.id },
            orderBy: { observed: 'desc' },
          })
          if (
            !latest ||
            latest.observed.toISOString().slice(0, 10) !==
              updatedAt.toISOString().slice(0, 10) ||
            previous?.price !== price ||
            previous?.shipping !== shipping
          )
            await tx.priceHistory.create({
              data: { offerId: offer.id, price, shipping, observed: updatedAt },
            })
        }
        if (!source.demo && connector.snapshot !== false)
          await tx.offer.updateMany({
            where: {
              sourceId,
              externalId: { notIn: rows.map((row) => row.id) },
              availability: { not: 'out' },
            },
            data: { availability: 'out', updatedAt },
          })
        await tx.dataSource.update({
          where: { id: sourceId },
          data: { updatedAt },
        })
        await tx.importJob.update({
          where: { id: job.id },
          data: { status: 'done', count: rows.length },
        })
      },
      { timeout: 30000 },
    )
    return rows.length
  } catch (error) {
    const detail =
      error instanceof Error ? error.message.slice(0, 500) : 'Import zlyhal.'
    await db.importJob.update({
      where: { id: job.id },
      data: { status: 'failed', error: detail },
    })
    throw error
  }
}
