import { describe, expect, it, vi } from 'vitest'
import { makeLiveSearch } from '../lib/live-search'
import { CatalogHttpError } from '../lib/catalog-http'
import type { LocalListing } from '../lib/local-listings'

const settings = {
  bazos: {
    endpoint: 'https://www.bazos.sk/search.php?rubriky=www',
    queryParam: 'hledat',
    minIntervalMs: 1000,
    maxPerMinute: 60,
    maxPerDay: 300,
    refreshMs: 3600000,
  },
}
const html =
  '<div class="inzeraty inzeratyflex"><div class="inzeratynadpis"><h2 class="nadpis"><a href="https://pc.bazos.sk/inzerat/123/ps5.php">PlayStation 5</a></h2></div><div class="inzeratycena">660 €</div></div>'

describe('live HTML search', () => {
  it('uses the approved endpoint, returns a price, and deduplicates concurrent queries', async () => {
    const read = vi.fn<(url: URL, accept: string) => Promise<string>>(
      async () => html,
    )
    const search = makeLiveSearch(settings, read)
    const results = await Promise.all([
      search('PS5 & Slim'),
      search('PS5 & Slim'),
    ])
    expect(results[0]).toEqual(results[1])
    expect(results[0][0]).toMatchObject({
      provider: 'bazos',
      status: 'live',
      rows: [{ name: 'PlayStation 5', priceCents: 66000 }],
    })
    expect(read).toHaveBeenCalledTimes(1)
    const url = read.mock.calls[0][0]
    expect(url.searchParams.get('hledat')).toBe('PS5 & Slim')
    expect(url.searchParams.get('rubriky')).toBe('www')
    expect((await search('notebook'))[0].status).toBe('limited')
  })

  it('does not send requests for blank queries or unconfigured sources', async () => {
    const read = vi.fn(async () => html)
    expect(await makeLiveSearch({}, read)('PS5')).toEqual([])
    expect(await makeLiveSearch(settings, read)(' ')).toEqual([])
    expect(read).not.toHaveBeenCalled()
  })

  it('keeps one source usable when the other fails and refuses foreign endpoints', async () => {
    const read = vi.fn(async (url: URL) => {
      if (url.hostname === 'www.alza.sk') throw new CatalogHttpError(403)
      return html
    })
    const alza = {
      endpoint: 'https://www.alza.sk/partner-search',
      queryParam: 'q',
      minIntervalMs: 1000,
      maxPerMinute: 50,
      maxPerDay: 1000,
      refreshMs: 3600000,
    }
    const result = await makeLiveSearch(
      { ...settings, alza },
      read,
    )('PlayStation 5')
    expect(result.map(({ provider, status }) => [provider, status])).toEqual([
      ['alza', 'blocked'],
      ['bazos', 'live'],
    ])
    expect(
      await makeLiveSearch(
        { alza: { ...alza, endpoint: 'https://alza.sk.example.com/anything' } },
        read,
      )('test'),
    ).toEqual([])
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('returns a merchant photo only when its source has image approval', async () => {
    const photo = 'https://www.bazos.sk/img/1t/123.jpg'
    const withPhoto = html.replace(
      '<h2',
      '<img class="obrazek" src="' + photo + '"><h2',
    )
    const read = async () => withPhoto
    const disabled = await makeLiveSearch(settings, read)('PS5')
    expect(disabled[0].rows[0].image).toBeNull()
    const enabled = await makeLiveSearch(
      { bazos: { ...settings.bazos, imagesAllowed: true } },
      read,
    )('PS5')
    expect(enabled[0].rows[0].image).toBe(photo)
  })

  it('allows new and repeated Bazoš queries without local limits when approved', async () => {
    const read = vi.fn(async () => html)
    const reserve = vi.fn(async () => false)
    const retain = vi.fn(async () => [])
    const search = makeLiveSearch(
      { bazos: { ...settings.bazos, unlimited: true, maxPerDay: 1 } },
      read,
      reserve,
      retain,
    )
    expect((await search('PS5'))[0].status).toBe('live')
    const results = await Promise.all([search('PS5'), search('PS5')])
    expect(results[0][0].status).toBe('live')
    expect((await search('notebook'))[0].status).toBe('live')
    expect(read).toHaveBeenCalledTimes(3)
    expect(reserve).not.toHaveBeenCalled()
    expect(retain).not.toHaveBeenCalled()
  })

  it('enforces rolling quotas and the hourly query refresh window', async () => {
    vi.useFakeTimers()
    try {
      const read = vi.fn(async () => html)
      const bazos = { ...settings.bazos, maxPerMinute: 1, maxPerDay: 2 }
      const search = makeLiveSearch({ bazos }, read)
      expect((await search('PS5'))[0].status).toBe('live')
      vi.advanceTimersByTime(2000)
      expect((await search('notebook'))[0].status).toBe('limited')
      expect((await search('ps5'))[0].status).toBe('live')
      expect(read).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(60000)
      expect((await search('notebook'))[0].status).toBe('live')
      vi.advanceTimersByTime(3600000)
      expect((await search('PS5'))[0].status).toBe('limited')
      vi.advanceTimersByTime(86400000)
      expect((await search('PS5'))[0].status).toBe('live')
      expect(read).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reuses persisted query results after restart without consuming a request', async () => {
    vi.useFakeTimers()
    try {
      let stored: { rows: LocalListing[]; expires: number } | null = null
      const cache = {
        get: vi.fn(async (_provider: string, _key: string, now: number) =>
          stored && stored.expires > now ? stored : null,
        ),
        set: vi.fn(async (
          _provider: string, _key: string, rows: LocalListing[], now: number,
        ) => {
          stored = { rows, expires: now + settings.bazos.refreshMs }
        }),
      }
      const read = vi.fn(async () => html)
      const reserve = vi.fn(async () => true)
      const first = makeLiveSearch(settings, read, reserve, undefined, cache)
      expect((await first('PS5'))[0].status).toBe('live')
      vi.advanceTimersByTime(1800000)
      reserve.mockResolvedValue(false)
      const restarted = makeLiveSearch(settings, read, reserve, undefined, cache)
      expect((await restarted('ps5'))[0]).toMatchObject({
        status: 'live', rows: [{ name: 'PlayStation 5' }],
      })
      expect(read).toHaveBeenCalledTimes(1)
      expect(reserve).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(1800001)
      reserve.mockResolvedValue(true)
      expect((await restarted('ps5'))[0].status).toBe('live')
      expect(read).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
