import { load } from 'cheerio'
import { cents } from './domain'
import { safeUrl } from './importer'
import { shopPhoto, type ShopSource } from './shop-sources'
import type { LocalListing } from './local-listings'

const text = (value: unknown) => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : ''
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const array = (value: unknown) => Array.isArray(value) ? value : value ? [value] : []

export function extractShopListings(html: string, shop: ShopSource): LocalListing[] {
  const $ = load(html)
  const origin = new URL(shop.endpoint)
  const listings = new Map<string, LocalListing>()
  const add = (name: string, rawPrice: string, href: string, image: unknown, id?: string, priceLabel?: string) => {
    if (!href) return
    let url: URL
    try { url = new URL(href, origin) } catch { return }
    if (!safeUrl(url.href) || url.hostname.replace(/^www\./, '') !== origin.hostname.replace(/^www\./, '')) return
    url.hash = ''
    let normalized = rawPrice.replace(/\s+/gu, '').replace(/(?:EUR|€)/gi, '')
    if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(normalized)) normalized = normalized.replaceAll('.', '')
    const price = cents(normalized)
    const key = url.href
    const photo = shopPhoto(image, shop)
    const previous = listings.get(key)
    if (!name || name.length > 400 || price === null || price <= 0) {
      if (previous && photo) listings.set(key, { ...previous, image: photo })
      return
    }
    listings.set(key, { id: id || key, name, priceCents: price, url: key, image: photo ?? previous?.image ?? null, ...(priceLabel && { priceLabel }) })
  }

  // Retailers expose products inside ItemList, SearchAction or @graph, not only at the root.
  const visit = (raw: unknown, depth = 0) => {
    if (depth > 15) return
    if (Array.isArray(raw)) { raw.forEach((node) => visit(node, depth + 1)); return }
    const node = object(raw)
    const types = array(node['@type']).map(text)
    if (types.includes('Product')) {
      const offers = array(node.offers).map(object)
      if (offers.length === 1 && offers[0]['@type'] === 'Offer' && offers[0].priceCurrency === 'EUR') {
        const offer = offers[0]
        const image = array(node.image)[0]
        add(text(node.name), String(offer.price ?? ''), text(node.url) || text(offer.url), text(image) || text(object(image).url), text(node.sku) || text(node.identifier))
      }
    }
    for (const value of Object.values(node))
      if (value && typeof value === 'object') visit(value, depth + 1)
  }
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    try { visit(JSON.parse($(script).text())) } catch { /* Unsupported or invalid structured data. */ }
  }

  const cards = shop.cards || '.product, .product-layout, .product-thumb, .product-item, .item-product, [itemscope][itemtype$="Product"]'
  for (const element of $(cards).toArray()) {
    const card = $(element)
    const title = card.find(shop.title || 'a.name, .name a, .product-title a, h2 a, h3 a, h4 a, a[itemprop="url"], a[itemprop="name"]').first()
    const name = text(title.text()) || text(card.find('[itemprop="name"]').first().attr('content'))
    const href = title.attr('href') || title.closest('a[href]').attr('href') || card.find('[itemprop="url"]').first().attr('href') || ''
    let priceNode = card.find(shop.price || '[itemprop="price"]').first()
    if (!priceNode.length && !shop.price)
      for (const selector of ['.price-final', '.price-new', '.price']) {
        priceNode = card.find(selector).first()
        if (priceNode.length) break
      }
    const priceText = priceNode.attr('content') || priceNode.attr('data-test-value') || text(priceNode.text())
    const match = /(?:^|[^\d])([\d][\d\s.,]*)\s*(?:€|EUR)|(?:€|EUR)\s*([\d][\d\s.,]*)/u.exec(priceText)
    const amount = match?.[1] || match?.[2]
    const price = amount || (/^\d+(?:[,.]\d{1,2})?$/.test(priceText) ? priceText : '')
    const image = card.find(shop.image || '.image img, .p-image img, img[itemprop="image"], img').first()
    add(name, price, href, image.attr('data-src') || image.attr('data-original') || image.attr('src'), card.attr('data-id') || card.attr('data-micro-product-id'))
  }
  return [...listings.values()].slice(0, 60)
}

export function isEmptyShopSearch(html: string) {
  const $ = load(html)
  const content = $('main, #content, .no-products, .no-found').text()
  return /produkty neboli nájdené|žiadne produkty|žiadny produkt nezodpovedá|žiadny produkt nevyhovuje|neboli nájdené žiadne/i.test(content) ||
    ($('body').hasClass('product-search') && /vyhľadávanie/i.test($('h1').text()) && !$('.product-layout, .product-thumb').length)
}
