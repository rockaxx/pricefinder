import { existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'
import { sourceUrl } from './catalog-http'

export type ShopSource = {
  id: string
  name: string
  endpoint: string
  queryParam: string
  imageHosts: string[]
  cards?: string
  title?: string
  price?: string
  image?: string
}

// Search URLs come from each shop's own search form or SearchAction markup.
const builtInSources: ShopSource[] = [
  { id: 'nay', name: 'NAY', endpoint: 'https://www.nay.sk/vyhladavanie', queryParam: 'q', imageHosts: ['image.nay.sk'], cards: '.product-box', title: '.item-title a', price: '.item-price .price-box', image: '.item-thumbnail img' },
  { id: 'planeo', name: 'PLANEO', endpoint: 'https://www.planeo.sk/vyhladavanie$a1013-search', queryParam: 'query', imageHosts: ['mc-static.fast.eu'], cards: '.c-product--catalogue', title: '.c-product__title a', price: '.c-product__price strong', image: '.c-product__image img' },
  { id: 'tpd', name: 'TPD', endpoint: 'https://www.tpd.sk/vyhladavanie', queryParam: 'search', imageHosts: ['images.tpd.sk'], cards: '.products__item', title: '.products__name', price: '.products__price--actual .number', image: '.products__img img' },
  { id: 'andreashop', name: 'Andrea Shop', endpoint: 'https://www.andreashop.sk/vyhladavanie', queryParam: 'search', imageHosts: ['images.tpd.sk', 'images.andreashop.sk'], cards: '.products__item', title: '.products__name', price: '.products__price--actual .number', image: '.products__img img' },
  { id: 'datacomp', name: 'Datacomp', endpoint: 'https://datacomp.sk/default.asp?cls=stoitems', queryParam: 'fulltext', imageHosts: ['img.datacomp.sk'], cards: '.boxcont.products .prodbox', title: 'a.stiplname', price: '.price .wvat span' },
  { id: 'itsk', name: 'ITSK – HENRY', endpoint: 'https://www.itsk.sk/default.asp?cls=stoitems', queryParam: 'fulltext', imageHosts: ['img.itsk.sk'], cards: '.boxcont.products .prodbox', title: 'a.stiplname', price: '.price .wvat span' },
  { id: 'mironet', name: 'Mironet', endpoint: 'https://www.mironetcz.sk/ProductList/showSearch', queryParam: 'EXPF', imageHosts: ['img.mironet.cz', 'www.mironet.cz'], cards: '#productContainer .item_b', title: 'a.item_b_name', price: '.item_b_cena' },
  { id: 'mobilpc', name: 'MobilPC', endpoint: 'https://www.mobilpc.sk/hladat/', queryParam: 'q', imageHosts: ['images.mobilpc.sk'] },
  { id: 'najmobily', name: 'Najmobily', endpoint: 'https://www.najmobily.sk/vyhladavanie/', queryParam: 'string', imageHosts: ['cdn.myshoptet.com'] },
  { id: 'compy', name: 'Compy', endpoint: 'https://www.compy.sk/vyhladavanie/', queryParam: 'string', imageHosts: ['cdn.myshoptet.com'] },
  { id: 'elektroshock', name: 'Elektroshock', endpoint: 'https://www.elektroshock.sk/vyhladavanie/', queryParam: 'string', imageHosts: ['cdn.myshoptet.com'] },
  { id: 'danimani', name: 'Danimani', endpoint: 'https://www.danimani.sk/index.php?route=product/search', queryParam: 'search', imageHosts: [] },
  { id: 'mobilmarket', name: 'Mobilmarket', endpoint: 'https://www.mobilmarket.sk/index.php?route=product/search', queryParam: 'search', imageHosts: [] },
  { id: 'mader', name: 'MADER', endpoint: 'https://www.mader.sk/searchSetup?searchType=2', queryParam: 'searchedName', imageHosts: [], cards: '.productsList .item', title: 'h2 a', price: '.description .price' },
  { id: 'hdmobil', name: 'HDmobil', endpoint: 'https://www.hdmobil.sk/sk/search?controller=search', queryParam: 'search_query', imageHosts: [], cards: '.product_list .ajax_block_product', title: 'a.product-name', price: '.content_price .product-price', image: '.product_img_link img' },
]

const selector = z.string().min(1).max(1000).optional()
const customSourceSchema = z.array(z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,60}$/),
  name: z.string().min(1).max(100),
  endpoint: z.string().max(2048).url(),
  queryParam: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  imageHosts: z.array(z.string().regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/)).max(20),
  cards: selector, title: selector, price: selector, image: selector,
})).max(500)

function customSources(): ShopSource[] {
  const path = process.env.RETAIL_SEARCH_CONFIG || 'merchant-search.local.json'
  // Operator-supplied runtime config is deployed separately, not bundled with project files.
  if (!existsSync(/* turbopackIgnore: true */ path)) return []
  return validateShopSources(JSON.parse(readFileSync(/* turbopackIgnore: true */ path, 'utf8')))
}

export function validateShopSources(raw: unknown): ShopSource[] {
  const sources = customSourceSchema.parse(raw)
  const ids = new Set(['alza', 'bazos', ...builtInSources.map((shop) => shop.id)])
  for (const shop of sources) {
    sourceUrl(shop.endpoint)
    if (ids.has(shop.id)) throw Error('Duplicitný identifikátor obchodu: ' + shop.id)
    ids.add(shop.id)
  }
  return sources
}

export const shopSources: ShopSource[] = [...builtInSources, ...customSources()]

export function enabledShopSources() {
  const enabled = new Set((process.env.RETAIL_SEARCH_PROVIDERS || '').split(',').map((id) => id.trim()))
  return shopSources.filter((shop) => enabled.has(shop.id))
}

export function shopSearchUrl(shop: ShopSource, query: string) {
  const url = new URL(shop.endpoint)
  url.searchParams.set(shop.queryParam, query)
  return url
}

export function shopPhoto(raw: unknown, shop: ShopSource) {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const origin = new URL(shop.endpoint)
    const url = new URL(raw, origin)
    const hosts = [origin.hostname, origin.hostname.replace(/^www\./, ''), ...shop.imageHosts]
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts.includes(url.hostname)
      ? url.href : null
  } catch { return null }
}
