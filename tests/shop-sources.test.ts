import { describe, expect, it } from 'vitest'
import { validateShopSources } from '../lib/shop-sources'

const source = {
  id: 'extra-shop', name: 'Extra shop', endpoint: 'https://shop.example.com/search',
  queryParam: 'q', imageHosts: ['images.example.com'],
  cards: '.card', title: 'a.name', price: '.gross-price', image: 'img',
}

describe('additional HTML source configuration', () => {
  it('accepts another shop with custom selectors without a code change', () => {
    expect(validateShopSources([source])).toEqual([source])
  })
  it('rejects duplicate or reserved IDs and non-HTTPS endpoints', () => {
    expect(() => validateShopSources([source, source])).toThrow('Duplicitný')
    expect(() => validateShopSources([{ ...source, id: 'nay' }])).toThrow('Duplicitný')
    expect(() => validateShopSources([{ ...source, endpoint: 'http://shop.example.com' }])).toThrow()
    expect(() => validateShopSources([{ ...source, endpoint: 'https://user:password@shop.example.com' }])).toThrow()
  })
})
