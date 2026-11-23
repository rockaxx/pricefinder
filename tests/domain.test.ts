import { describe, expect, it } from 'vitest'
import { cents, match, relevance, total } from '../lib/domain'
const products = [
  {
    id: 'disc',
    name: 'Sony PlayStation 5 Slim Disc 1 TB',
    brand: 'Sony',
    gtin: null,
  },
  {
    id: 'digital',
    name: 'Sony PlayStation 5 Slim Digital 1 TB',
    brand: 'Sony',
    gtin: null,
  },
]
describe('variant matching and comparison', () => {
  it('does not merge a generic or conflicting listing', () => {
    expect(
      match({ name: 'Sony PlayStation 5 Slim', brand: 'Sony' }, products).id,
    ).toBeNull()
    expect(
      match(
        { name: 'Sony PlayStation 5 Slim Disc 825 GB', brand: 'Sony' },
        products,
      ).id,
    ).toBeNull()
    expect(
      match(
        { name: 'Sony PlayStation 5 Slim Disc 1TB', brand: 'Sony' },
        products,
      ).id,
    ).toBe('disc')
  })
  it('handles common search spelling variations', () => {
    expect(relevance('playstaton 5', products[0].name)).toBeGreaterThan(0)
    expect(relevance('ps5', products[0].name)).toBeGreaterThan(0)
    expect(relevance('playstation 4', products[0].name)).toBe(0)
  })
  it('preserves unknown shipping and parses exact decimal amounts', () => {
    expect(total({ price: 500, shipping: null })).toBeNull()
    expect(total({ price: 500, shipping: 0 })).toBe(500)
    expect(cents('399,09')).toBe(39909)
    expect(cents('399,099')).toBeNull()
  })
})
