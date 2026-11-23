import { describe, expect, it } from 'vitest'
import {
  parseFeed,
  sampleXml,
  safeUrl,
  sampleMarketplace,
} from '../lib/importer'
import { dealScore } from '../lib/deals'
describe('approved feed imports', () => {
  it('parses cents, availability and uses the merchant hostname', () => {
    expect(parseFeed(sampleXml, 'xml', 'example.com')[0]).toMatchObject({
      price: 45900,
      shipping: 499,
      availability: 'in',
    })
    expect(() => parseFeed(sampleXml, 'xml', 'shop.example.com')).toThrow()
    expect(() => parseFeed(sampleXml, 'xml')).toThrow()
  })
  it('rejects XML declarations for external entities and unsafe URL schemes', () => {
    expect(() =>
      parseFeed('<!DOCTYPE SHOP>' + sampleXml, 'xml', 'example.com'),
    ).toThrow()
    expect(safeUrl('http://example.com')).toBeNull()
    expect(safeUrl('https://example.com@localhost/')).toBeNull()
    expect(safeUrl('https://127.0.0.1/')).toBeNull()
  })
  it('preserves escaped product link parameters and rejects a non-euro feed price', () => {
    const xml = sampleXml.replace(
      '/product/ps5</URL>',
      '/product/ps5?a=1&amp;b=2</URL>',
    )
    expect(parseFeed(xml, 'xml', 'example.com')[0].url).toBe(
      'https://example.com/product/ps5?a=1&b=2',
    )
    expect(() =>
      parseFeed(
        xml.replace('</PRICE_VAT>', '</PRICE_VAT><CURRENCY>USD</CURRENCY>'),
        'xml',
        'example.com',
      ),
    ).toThrow('EUR')
  })
  it('parses marketplace metadata', async () => {
    expect(
      parseFeed(await sampleMarketplace.read(), 'csv', null, true)[0],
    ).toMatchObject({
      sellerType: 'private',
      condition: 'used',
      location: 'Bratislava',
    })
  })
})
describe('deal scoring', () => {
  it('uses real comparable dated observations and excludes demos', () => {
    const history = Array.from({ length: 5 }, (_, i) => ({
      price: 10000,
      shipping: 0,
      observed: new Date(Date.now() - (i + 2) * 86400000),
    }))
    const offer = { price: 8000, shipping: 0, history, source: { demo: false } }
    expect(dealScore(offer)).toEqual({ percent: 20, median: 10000, samples: 5 })
    expect(dealScore({ ...offer, source: { demo: true } })).toBeNull()
    expect(dealScore({ ...offer, shipping: null })).toBeNull()
    expect(dealScore({ ...offer, history: history.slice(1) })).toBeNull()
  })
})
