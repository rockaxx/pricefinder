import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => undefined) }))
vi.mock('../lib/catalog-http', async (original) => ({
  ...await original<typeof import('../lib/catalog-http')>(), readCatalogUrl: vi.fn(),
}))
import { CatalogHttpError, readCatalogUrl } from '../lib/catalog-http'
import { readSearchUrl } from '../lib/search-http'

describe('bounded retailer search redirects', () => {
  beforeEach(() => vi.mocked(readCatalogUrl).mockReset())
  it('follows a shop search redirect to its own category with a separate HTML size cap', async () => {
    vi.mocked(readCatalogUrl).mockRejectedValueOnce(new CatalogHttpError(301, '/playstation-5')).mockResolvedValueOnce('<main>products</main>')
    expect(await readSearchUrl(new URL('https://www.nay.sk/vyhladavanie?q=ps5'), 'text/html')).toBe('<main>products</main>')
    expect(vi.mocked(readCatalogUrl).mock.calls[1][0].href).toBe('https://www.nay.sk/playstation-5')
    expect(vi.mocked(readCatalogUrl).mock.calls[1][2]).toBe(5_000_000)
  })
  it('refuses cross-shop redirects before requesting the destination', async () => {
    vi.mocked(readCatalogUrl).mockRejectedValueOnce(new CatalogHttpError(302, 'https://other.example.com/price'))
    await expect(readSearchUrl(new URL('https://www.nay.sk/vyhladavanie?q=ps5'), 'text/html')).rejects.toThrow('mimo obchodu')
    expect(readCatalogUrl).toHaveBeenCalledTimes(1)
  })
  it('detects redirect loops', async () => {
    vi.mocked(readCatalogUrl).mockRejectedValueOnce(new CatalogHttpError(302, '/search'))
    await expect(readSearchUrl(new URL('https://www.nay.sk/search'), 'text/html')).rejects.toThrow('slučku')
  })
  it('propagates HTTP 403 without retrying', async () => {
    vi.mocked(readCatalogUrl).mockRejectedValueOnce(new CatalogHttpError(403))
    await expect(readSearchUrl(new URL('https://www.nay.sk/search'), 'text/html')).rejects.toThrow('HTTP 403')
    expect(readCatalogUrl).toHaveBeenCalledTimes(1)
  })
})
