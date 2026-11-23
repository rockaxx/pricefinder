import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/db', () => ({
  db: { offer: { findMany: vi.fn(async () => []) } },
}))
vi.mock('../lib/live-search', () => ({
  liveProviderName: { alza: 'Alza.sk', bazos: 'Bazoš.sk' },
  imagesAllowed: () => true,
  liveSearch: vi.fn(),
}))

import { liveSearch } from '../lib/live-search'
import { db } from '../lib/db'
import { LocalSearch } from '../components/local-search'
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
    expect(result.type).toBe(LocalSearch)
    expect(result.props).toMatchObject({
      query: 'playstation 5', page: 2,
      filters: { min: '120', max: '380', sort: 'price' },
    })
  })

  it('renders photos and Bazoš offers beside filters without a second empty catalog or Alza', async () => {
    const html = renderToStaticMarkup(await LocalSearch({ query: 'playstation 5' }))
    expect(liveSearch).toHaveBeenCalledWith('playstation 5')
    expect(db.offer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ merchant: { name: 'Bazoš.sk' } }),
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

  it('applies price limits and sorting before pagination and preserves filters in page links', async () => {
    const html = renderToStaticMarkup(await LocalSearch({
      query: 'playstation 5', filters: { min: '120', max: '380', sort: 'price-desc' },
    }))
    expect(html).toContain('27 ponúk')
    expect(html).toContain('min=120&amp;max=380&amp;sort=price-desc&amp;page=2')
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
})
