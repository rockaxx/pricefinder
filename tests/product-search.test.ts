import { describe, expect, it } from 'vitest'
import { productRelevance, sourceSearchQuery } from '../lib/product-search'

describe('product intent', () => {
  it.each(['ps5', 'PlayStation 5'])('keeps consoles and bundles for %s', (query) => {
    const score = productRelevance(query)
    for (const title of [
      'Sony PS5',
      'Playstation 5 Pro - 2TB',
      'PS5 s mechanikou (825 GB) + ovládač + hry',
      'Herná konzola Sony PlayStation 5 Digital (typ modelu - slim) biela',
      'PlayStation 5 Digital B Chassis/EAS PS719710295',
      'Predám Novú Playstation 5 Slim 1TB + Hry',
    ]) expect(score(title), title).toBeGreaterThan(0)
    for (const title of [
      'Predám originálne hry na PlayStation 5',
      'PS5 - Death Stranding',
      'EA Battlefield 6 PS5',
      'PlayStation 5 DualSense GTA 6 Limited Edition',
      'PS5 Slim vertikálny stojan',
      'Disková mechanika pre PlayStation 5 Digital Edition',
      'Sony PS5 Portal',
      'PS5 prázdna krabica',
      'Kúpim PS5',
    ]) expect(score(title), title).toBe(0)
  })

  it('honors console variants, requested games and accessories independently', () => {
    expect(productRelevance('ps5 slim')('Sony PS5 Pro 2 TB')).toBe(0)
    expect(productRelevance('ps5 pro')('PS5 Pro 2 TB')).toBeGreaterThan(0)
    expect(productRelevance('ps5 hry')('PS5 - Death Stranding')).toBeGreaterThan(0)
    expect(productRelevance('ps5 hry')('PS5 Slim + hra')).toBe(0)
    expect(productRelevance('ps5 ovládač')('Sony DualSense Midnight Black')).toBeGreaterThan(0)
    expect(productRelevance('ps5 ovládač')('PS5 Slim + ovládač')).toBe(0)
    expect(productRelevance('ps5 ovládač')('TRUST Controller Sleeve PS5')).toBe(0)
    expect(productRelevance('ps5 ovládač')('Stojan pre herný ovládač PS5')).toBe(0)
    expect(productRelevance('ps5 stojan ovládač')('Stojan pre herný ovládač PS5')).toBeGreaterThan(0)
    expect(productRelevance('ps5 stojan')('Kryt pre PS5')).toBe(0)
  })

  it('rejects compatibility-only matches in other searches and keeps explicit accessory searches', () => {
    expect(productRelevance('iphone 16')('Kryt pre iPhone 16')).toBe(0)
    expect(productRelevance('iphone 16')('Apple iPhone 16 128 GB')).toBeGreaterThan(0)
    expect(productRelevance('kryt iphone 16')('Kryt pre iPhone 16')).toBeGreaterThan(0)
    expect(sourceSearchQuery('PS5')).toBe('playstation 5')
    expect(sourceSearchQuery('PS5 hry')).toBe('PS5 hry')
  })
})
