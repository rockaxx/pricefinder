import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/db', () => ({
  db: { offer: { findMany: vi.fn(async () => []) } },
}))
vi.mock('../lib/live-search', () => ({
  liveProviderName: { alza: 'Alza.sk', bazos: 'Bazoš.sk', nay: 'NAY', planeo: 'PLANEO' },
  imagesAllowed: () => true,
  liveSearch: Object.assign(vi.fn(), { requests: vi.fn() }),
}))

import { liveSearch } from '../lib/live-search'
import type { LiveSearchResult } from '../lib/live-search'
import { db } from '../lib/db'
import { LocalSearch as StreamingSearch } from '../components/local-search'
import { SearchResultView } from '../components/search-result-view'
import { loadSearchView } from '../lib/search-results'
import { GET as streamRoute } from '../app/api/search/route'

async function LocalSearch(props: Parameters<typeof loadSearchView>[0]) {
  return SearchResultView({ view: await loadSearchView(props) })
}
import Page from '../app/vyhladavanie/page'

describe('Bazoš search results', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(liveSearch).mockResolvedValue([
      { provider: 'alza', status: 'blocked', rows: [] },
      {
        provider: 'bazos', status: 'live',
        rows: Array.from({ length: 30 }, (_, i) => ({
          id: String(i), name: 'PlayStation 5 Slim ' + i,
          priceCents: 10000 + i * 1000,
          url: 'https://pc.bazos.sk/inzerat/' + i + '/ps5.php',
          image: 'https://www.bazos.sk/img/1t/' + i + '.jpg',
        })),
      },
    ])
  })
  afterEach(() => vi.unstubAllEnvs())

  it('routes configured Bazoš search to one results layout with the active filters', async () => {
    vi.stubEnv('BAZOS_SEARCH_ENDPOINT', 'https://www.bazos.sk/search.php')
    const result = await Page({ searchParams: Promise.resolve({
      q: 'playstation 5', min: '120', max: '380', sort: 'price', page: '2',
    }) })
    expect(result.type).toBe(StreamingSearch)
    expect(result.props).toMatchObject({
      query: 'playstation 5', page: 2,
      filters: { min: '120', max: '380', sort: 'price' },
    })
  })

  it('streams the search status and a fast offer before the slow source finishes', async () => {
    let finishSlow!: (source: LiveSearchResult) => void
    const slow = new Promise<LiveSearchResult>((resolve) => { finishSlow = resolve })
    const source = (provider: string, name: string): LiveSearchResult => ({
      provider, status: 'live',
      rows: [{ id: '1', name, priceCents: 59000, url: 'https://www.nay.sk/iphone-16', image: null }],
    })
    vi.mocked(liveSearch.requests).mockReturnValue([
      { provider: 'nay', result: Promise.resolve(source('nay', 'Apple iPhone 16 rýchla ponuka')) },
      { provider: 'planeo', result: slow },
    ])
    const response = streamRoute(new Request('http://localhost/api/search?q=iphone+16'))
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
    try {
      const first = await reader.read()
      expect(first.value).toContain('Apple iPhone 16 rýchla ponuka')
      expect(first.value).not.toContain('Apple iPhone 16 pomalá ponuka')
      expect(first.value).toContain('"type":"offer"')
      finishSlow(source('planeo', 'Apple iPhone 16 pomalá ponuka'))
      let rest = ''
      while (true) {
        const next = await reader.read()
        if (next.done) break
        rest += next.value
      }
      expect(rest).toContain('Apple iPhone 16 pomalá ponuka')
      const messages = rest.trim().split('\n').map((line) => JSON.parse(line))
      expect(messages.at(-1)).toMatchObject({ type: 'done', view: { count: 2 } })
      expect(liveSearch.requests).toHaveBeenCalledTimes(1)
      expect(liveSearch).not.toHaveBeenCalled()
    } finally {
      finishSlow(source('planeo', 'Apple iPhone 16 pomalá ponuka'))
      await reader.cancel()
    }
  })

  it('renders photos and Bazoš offers beside filters without a second empty catalog or Alza', async () => {
    const html = renderToStaticMarkup(await LocalSearch({ query: 'playstation 5' }))
    expect(liveSearch).toHaveBeenCalledWith('playstation 5')
    expect(db.offer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ source: { enabled: true, demo: false } }),
    }))
    expect(html).toContain('class="results listing-results"')
    expect(html).toContain('30 ponúk')
    expect(html).toContain('https://www.bazos.sk/img/1t/0.jpg')
    expect(html).toContain('page=2')
    expect(html).not.toContain('Alza')
    expect(html).not.toContain('HTTP 403')
    expect(html).not.toContain('Nenašli sa žiadne produkty')
    expect(html).not.toContain('class="empty"')
  })

  it('combines retailers with Bazoš and filters a shop without duplicating the catalog', async () => {
    vi.mocked(liveSearch).mockResolvedValue([
      { provider: 'nay', status: 'live', rows: [{ id: 'sony', name: 'Sony PS5', priceCents: 60000, url: 'https://www.nay.sk/sony-ps5', image: 'https://image.nay.sk/sony.jpg' }] },
      { provider: 'bazos', status: 'live', rows: [{ id: 'used', name: 'Sony PS5 used', priceCents: 30000, url: 'https://pc.bazos.sk/inzerat/123/ps5.php', image: null }] },
    ])
    const combined = renderToStaticMarkup(await LocalSearch({ query: 'ps5' }))
    expect(combined).toContain('2 ponúk')
    expect(combined).toContain('NAY')
    expect(combined).toContain('Bazoš.sk')
    const filtered = renderToStaticMarkup(await LocalSearch({ query: 'ps5', filters: { shop: 'nay' } }))
    expect(filtered).toContain('1 ponúk')
    expect(filtered).toContain('https://image.nay.sk/sony.jpg')
    expect(filtered).not.toContain('>Sony PS5 used<')
  })

  it('applies price limits and sorting before pagination and preserves filters in page links', async () => {
    const html = renderToStaticMarkup(await LocalSearch({
      query: 'playstation 5', filters: { min: '120', max: '380', sort: 'price-desc' },
    }))
    expect(html).toContain('27 ponúk')
    expect(html).toContain('min=120&amp;max=380&amp;sort=price-desc&amp;typ=konzoly&amp;page=2')
    expect(html).not.toContain('>PlayStation 5 Slim 0<')
    expect(html).not.toContain('>PlayStation 5 Slim 29<')
    expect(html.indexOf('>PlayStation 5 Slim 28<')).toBeLessThan(
      html.indexOf('>PlayStation 5 Slim 27<'),
    )
    const second = renderToStaticMarkup(await LocalSearch({
      query: 'playstation 5', page: 2,
      filters: { min: '120', max: '380', sort: 'price-desc' },
    }))
    expect((second.match(/<article /g) ?? [])).toHaveLength(3)
    expect(second).toContain('>PlayStation 5 Slim 2<')
  })

  it('removes accessories and games before sorting a PS5 search by price', async () => {
    vi.mocked(liveSearch).mockResolvedValue([{
      provider: 'bazos', status: 'live',
      rows: [
        { id: '1', name: 'PS5 hry', priceCents: 1000, url: 'https://pc.bazos.sk/inzerat/1/hry.php', image: null },
        { id: '2', name: 'Sony PS5 Slim + hra', priceCents: 39000, url: 'https://pc.bazos.sk/inzerat/2/ps5.php', image: null },
        { id: '3', name: 'Sony PS5 DualSense', priceCents: 2500, url: 'https://pc.bazos.sk/inzerat/3/dualsense.php', image: null },
      ],
    }])
    const result = await LocalSearch({ query: 'PS5', filters: { sort: 'price' } })
    const html = renderToStaticMarkup(result)
    expect(liveSearch).toHaveBeenCalledWith('playstation 5')
    expect(html).toContain('Sony PS5 Slim + hra')
    expect(html).not.toContain('PS5 hry')
    expect(html).not.toContain('Sony PS5 DualSense')
    expect((html.match(/<article /g) ?? [])).toHaveLength(1)
  })

  it('opens the phone category for a bare iPhone query and keeps accessory categories selectable', async () => {
    vi.mocked(liveSearch).mockResolvedValue([{
      provider: 'nay', status: 'live',
      rows: [
        { id: '1', name: 'Apple iPhone 16 128 GB + kryt', priceCents: 59900, url: 'https://www.nay.sk/iphone-16', image: null },
        { id: '2', name: 'iPhone 16 Lepicí Páska pre LCD', priceCents: 295, url: 'https://www.nay.sk/iphone-16-paska', image: null },
        { id: '3', name: 'Silikónový kryt pre iPhone 16', priceCents: 999, url: 'https://www.nay.sk/iphone-16-kryt', image: null },
        { id: '4', name: 'Kamera tvrdené sklíčko iPhone 16', priceCents: 554, url: 'https://www.nay.sk/iphone-16-sklo', image: null },
      ],
    }])
    const phone = renderToStaticMarkup(await LocalSearch({ query: 'iphone 16', filters: { sort: 'price' } }))
    expect(phone).toContain('Apple iPhone 16 128 GB + kryt')
    expect(phone).not.toContain('iPhone 16 Lepicí Páska pre LCD')
    expect(phone).not.toContain('Silikónový kryt pre iPhone 16')
    expect(phone).toContain('sort=price&amp;typ=kryty')
    expect(phone).toContain('sort=price&amp;typ=diely')
    const cover = renderToStaticMarkup(await LocalSearch({ query: 'iphone 16', filters: { typ: 'kryty' } }))
    expect(cover).toContain('Silikónový kryt pre iPhone 16')
    expect(cover).not.toContain('Apple iPhone 16 128 GB + kryt')
    const glass = renderToStaticMarkup(await LocalSearch({ query: 'ochranné sklo iphone 16' }))
    expect(glass).toContain('Kamera tvrdené sklíčko iPhone 16')
    expect(glass).not.toContain('Silikónový kryt pre iPhone 16')
  })
})
