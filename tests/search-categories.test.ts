import { afterEach, expect, it, vi } from 'vitest'
import { buildSearchCategories } from '../lib/search-categories'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('uses the model to suggest new categories for products outside the known groups', async () => {
  vi.stubEnv('LISTING_MODEL_PORT', '5056')
  const model = vi.fn(async () => Response.json({
    choices: [{ message: { content: JSON.stringify({
      preferred: 'Tlačiarne',
      classes: [{ index: 0, label: 'Tlačiarne' }, { index: 1, label: 'Atramenty' }],
    }) } }],
  }))
  vi.stubGlobal('fetch', model)
  const offers = [
    { title: 'Epson EcoTank L3270', url: 'https://example.com/epson-l3270' },
    { title: 'Epson EcoTank 103 Cyan', url: 'https://example.com/epson-103-cyan' },
  ]
  const result = await buildSearchCategories('epson ecotank', offers)
  expect(result.preferred).toBe('tlaciarne')
  expect(result.categories).toEqual(['tlaciarne', 'atramenty'])
  expect(result.names.get('tlaciarne')).toBe('Tlačiarne')
  await buildSearchCategories('epson ecotank', offers)
  expect(model).toHaveBeenCalledTimes(1)
})

it('keeps a used phone with battery health in its title and leaves replacement batteries separate', async () => {
  vi.stubEnv('LISTING_MODEL_PORT', '')
  const result = await buildSearchCategories('iphone 16', [
    { title: 'Apple iPhone 16 128GB Black 90% Batéria', url: 'https://example.com/iphone-16-90-bateria' },
    { title: 'Apple iPhone 16 Pro', url: 'https://example.com/iphone-15-pro-zdravie-baterie' },
    { title: 'Batéria pre Apple iPhone 16 3561 mAh', url: 'https://example.com/bateria-iphone-16' },
  ])
  expect(result.preferred).toBe('mobily')
  expect(result.categories).toEqual(['mobily', 'mobily', 'diely'])
})
