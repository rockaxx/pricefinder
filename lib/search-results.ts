import { db } from './db'
import { cents } from './domain'
import { sourceSearchQuery } from './product-search'
import { buildSearchCategories, candidateRelevance, offerCategory, searchCategoryIntent } from './search-categories'
import { detectWantedListings } from './local-listing-model'
import { listingPhoto, providerSearchLinks } from './local-listings'
import { imagesAllowed, liveProviderName, liveSearch, type LiveSearchResult } from './live-search'
import { enabledShopSources, shopSources, shopSearchUrl } from './shop-sources'

const pageSize = 24

export type SearchProps = {
  query?: string
  page?: number
  filters?: Record<string, string>
}

type Offer = {
  id: string
  provider: string
  sourceName: string
  title: string
  url: string
  price: number
  listing: unknown
  score: number
  live: boolean
}

type ResolvedSource = { source: LiveSearchResult; offers: Offer[] }

function listingDetails(listing: unknown) {
  return listing && typeof listing === 'object' && !Array.isArray(listing)
    ? listing as Record<string, unknown>
    : null
}

async function excludeBuyerRequests(offers: Offer[]) {
  const bazos = offers.filter((offer) => offer.provider === 'bazos')
  if (!bazos.length) return offers
  const decisions = await detectWantedListings(bazos.map((offer) => {
    const description = listingDetails(offer.listing)?.description
    return { title: offer.title, description: typeof description === 'string' ? description : undefined }
  }))
  const wantedIds = new Set(bazos.filter((_, i) => decisions[i]).map((offer) => offer.id))
  return offers.filter((offer) => !wantedIds.has(offer.id))
}

async function resolveSource(result: LiveSearchResult, score: ReturnType<typeof candidateRelevance>): Promise<ResolvedSource> {
  const offers = result.status === 'live' ? result.rows.map((row): Offer => ({
    id: result.provider + ':' + row.id,
    provider: result.provider,
    sourceName: liveProviderName[result.provider],
    title: row.name,
    url: row.url,
    price: row.priceCents,
    listing: row,
    score: score(row.name, row.url),
    live: true,
  })).filter((offer) => offer.score > 0) : []
  return { source: result, offers: await excludeBuyerRequests(offers) }
}

function offerFilters(filters: Record<string, string>) {
  const minimum = cents(filters.min ?? '')
  const maximum = cents(filters.max ?? '')
  return (offer: Offer) =>
    (minimum === null || offer.price >= minimum) &&
    (maximum === null || offer.price <= maximum) &&
    (!filters.shop || offer.provider === filters.shop)
}

function offerOrder(sort: string | undefined) {
  return (a: Offer, b: Offer) => (
    sort === 'price' ? a.price - b.price :
      sort === 'price-desc' ? b.price - a.price :
        b.score - a.score || a.price - b.price
  ) || a.id.localeCompare(b.id)
}

export async function loadSearchView({
  query = '',
  page = 1,
  filters = {},
  sources,
}: SearchProps & { sources?: Promise<ResolvedSource[]> }) {
  const q = query.trim().slice(0, 100)
  const scoreProduct = candidateRelevance(q)
  const [offers, results] = await Promise.all([
    db.offer.findMany({
      where: {
        source: { enabled: true, demo: false },
        availability: { not: 'out' },
      },
      select: { id: true, title: true, price: true, url: true, listing: true, merchant: { select: { id: true, name: true, host: true } } },
    }),
    sources ?? liveSearch(sourceSearchQuery(q)).then((results) => Promise.all(
      results.filter((result) => result.provider !== 'alza').map((result) => resolveSource(result, scoreProduct)),
    )),
  ])
  const remote = results.map(({ source }) => source)
  const live = remote.filter((result) => result.status === 'live')
  const providerFor = (offer: (typeof offers)[number]) =>
    shopSources.find((shop) => new URL(shop.endpoint).hostname.replace(/^www\./, '') === offer.merchant.host?.replace(/^www\./, ''))?.id ||
    (offer.merchant.name === liveProviderName.bazos ? 'bazos' : offer.merchant.id)
  const liveIds = new Set(live.map((result) => result.provider))
  const snapshots = await excludeBuyerRequests(offers
    .filter((offer) => offer.merchant.name !== liveProviderName.alza && !liveIds.has(providerFor(offer)))
    .map((offer) => ({ ...offer, provider: providerFor(offer), sourceName: offer.merchant.name, score: scoreProduct(offer.title, offer.url), live: false }))
    .filter((offer) => offer.score > 0))
  const sourceOptions = new Map([
    ...remote.map((source) => [source.provider, liveProviderName[source.provider]] as const),
    ...enabledShopSources().map((shop) => [shop.id, shop.name] as const),
    ...snapshots.map((offer) => [offer.provider, offer.sourceName] as const),
  ])
  const sales = [...results.flatMap(({ offers }) => offers), ...snapshots]
  const categoryData = await buildSearchCategories(q, sales)
  const categoryCounts = new Map<string, number>()
  const visibleByPriceAndShop = sales.map((offer, index) => ({ ...offer, category: categoryData.categories[index] }))
    .filter(offerFilters(filters))
  for (const offer of visibleByPriceAndShop) {
    categoryCounts.set(offer.category, (categoryCounts.get(offer.category) ?? 0) + 1)
  }
  const offeredCategories = [...new Set(categoryData.categories)]
  const activeCategory = filters.typ === 'vsetko' || (filters.typ && offeredCategories.includes(filters.typ))
    ? filters.typ : categoryData.preferred
  const tabs = [...new Set(
    [categoryData.preferred, ...offeredCategories.sort((a, b) => (categoryCounts.get(b) ?? 0) - (categoryCounts.get(a) ?? 0))]
      .filter((id) => id !== 'vsetko'),
  )]
  const matches = visibleByPriceAndShop
    .filter((offer) => activeCategory === 'vsetko' || offer.category === activeCategory)
    .sort(offerOrder(filters.sort))
  const sourceCounts = new Map<string, number>()
  for (const offer of matches) {
    if (offer.live) sourceCounts.set(offer.provider, (sourceCounts.get(offer.provider) ?? 0) + 1)
  }
  const pages = Math.max(1, Math.ceil(matches.length / pageSize))
  const current = Math.min(pages, Math.max(1, page || 1))
  return {
    q, filters, activeCategory, current, pages,
    sourceOptions: [...sourceOptions],
    tabs: q && sales.length > 0 && tabs.length > 0
      ? [...tabs, 'vsetko'].map((id) => ({
        id,
        label: id === 'vsetko' ? 'Všetko' : categoryData.names.get(id) ?? id,
        count: id === 'vsetko' ? visibleByPriceAndShop.length : categoryCounts.get(id) ?? 0,
      }))
      : [],
    count: matches.length,
    matchingShops: new Set(matches.map((offer) => offer.provider)).size,
    matchingLiveShops: sourceCounts.size,
    sources: remote.map((source) => {
      const shop = shopSources.find((shop) => shop.id === source.provider)
      return {
        id: source.provider,
        name: liveProviderName[source.provider],
        status: source.status,
        count: sourceCounts.get(source.provider) ?? 0,
        link: shop ? shopSearchUrl(shop, q).href : providerSearchLinks(q)[0]?.url,
      }
    }),
    cards: matches.slice((current - 1) * pageSize, current * pageSize).map(card),
  }
}

function card(offer: Offer) {
  const data = listingDetails(offer.listing)
  return {
    id: offer.id, title: offer.title, url: offer.url, price: offer.price,
    sourceName: offer.sourceName, live: offer.live,
    priceLabel: typeof data?.priceLabel === 'string' ? data.priceLabel : null,
    photo: imagesAllowed(offer.provider) ? listingPhoto(data?.image, offer.provider) : null,
  }
}

export type SearchCard = ReturnType<typeof card>
export type SearchView = Awaited<ReturnType<typeof loadSearchView>>
export type SearchEvent =
  | { type: 'offer'; card: SearchCard }
  | { type: 'done'; view: SearchView }
  | { type: 'error' }

export async function streamSearch(props: SearchProps, publish: (event: SearchEvent) => void) {
  const q = (props.query ?? '').trim().slice(0, 100)
  const filters = props.filters ?? {}
  const category = filters.typ || searchCategoryIntent(q).preferred
  const score = candidateRelevance(q)
  const sources = liveSearch.requests(sourceSearchQuery(q))
    .filter(({ provider }) => provider !== 'alza')
    .map(async ({ result }) => {
      const resolved = await resolveSource(await result, score)
      if ((props.page || 1) <= 1) {
        const match = resolved.offers.filter(offerFilters(filters))
          .filter((offer) => !category || category === 'vsetko' || offerCategory(offer) === category)
          .sort(offerOrder(filters.sort))[0]
        if (match) publish({ type: 'offer', card: card(match) })
      }
      return resolved
    })
  const view = await loadSearchView({ ...props, sources: Promise.all(sources) })
  publish({ type: 'done', view })
}
