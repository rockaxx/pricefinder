import { describe, expect, it, vi } from 'vitest'
import { parseFeed } from '../lib/importer'
import { connectorFor, merchantSyncConfig } from '../lib/remote-catalog'
import { isPublicAddress, sourceUrl } from '../lib/catalog-http'

const page = 'https://www.example.com/product?variant=disc'
const config = {
  mode: 'pages',
  authorized: true,
  urls: [page],
} as const

function html(offer: Record<string, unknown>, extras = {}) {
  return `<html><script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: 'Shop' },
      {
        '@type': 'Product',
        name: 'Console Slim Disc',
        sku: 'disc-1',
        brand: { name: 'Example' },
        gtin13: '9501234567891',
        offers: {
          '@type': 'Offer',
          price: '429.99',
          priceCurrency: 'EUR',
          ...offer,
        },
        ...extras,
      },
    ],
  })}</script></html>`
}

describe('authorized merchant sync', () => {
  it('reads only configured pages and records actual values with unknown shipping', async () => {
    const read = vi
      .fn()
      .mockResolvedValue(html({ availability: 'https://schema.org/InStock' }))
    const connector = connectorFor(
      merchantSyncConfig.parse(config),
      'www.example.com',
      read,
    )
    expect(connector.snapshot).toBe(false)
    expect(
      parseFeed(await connector.read(), connector.format, 'www.example.com')[0],
    ).toMatchObject({
      id: 'page:disc-1',
      name: 'Console Slim Disc',
      price: 42999,
      shipping: null,
      availability: 'in',
      brand: 'Example',
      gtin: '9501234567891',
      url: page,
    })
    expect(read).toHaveBeenCalledTimes(1)
    expect(read.mock.calls[0][0].href).toBe(page)
  })

  it('requires operator authorization and checks every page origin before fetching', () => {
    expect(
      merchantSyncConfig.safeParse({ ...config, authorized: false }).success,
    ).toBe(false)
    expect(() =>
      connectorFor(
        merchantSyncConfig.parse({
          ...config,
          urls: [page, 'https://other.example.com/item'],
        }),
        'www.example.com',
      ),
    ).toThrow()
    expect(() =>
      sourceUrl('https://user:secret@example.com/catalog.xml'),
    ).toThrow()
    expect(() => sourceUrl('https://169.254.169.254/metadata')).toThrow()
    expect(isPublicAddress('127.0.0.1')).toBe(false)
    expect(isPublicAddress('::ffff:10.0.0.2')).toBe(false)
    expect(isPublicAddress('100.64.1.2')).toBe(false)
    expect(isPublicAddress('1.1.1.1')).toBe(true)
  })

  it.each([
    { priceCurrency: 'USD' },
    { '@type': 'AggregateOffer' },
    { price: 'free' },
  ])('rejects ambiguous or unsupported prices: %j', async (offer) => {
    const connector = connectorFor(
      merchantSyncConfig.parse(config),
      'www.example.com',
      async () => html(offer),
    )
    await expect(connector.read()).rejects.toThrow('EUR')
  })

  it('keeps an authorized feed as a complete snapshot', async () => {
    const feed = merchantSyncConfig.parse({
      mode: 'feed',
      authorized: true,
      format: 'xml',
      url: 'https://feeds.example.com/offer.xml?token=private',
    })
    const read = vi.fn().mockResolvedValue('<SHOP/>')
    const connector = connectorFor(feed, 'www.example.com', read)
    expect(connector.snapshot).toBe(true)
    expect(await connector.read()).toBe('<SHOP/>')
    expect(read.mock.calls[0][0].hostname).toBe('feeds.example.com')
  })
})
