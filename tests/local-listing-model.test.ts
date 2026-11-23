import { afterEach, expect, it, vi } from 'vitest'
import { detectWantedListings } from '../lib/local-listing-model'

const listings = [
  { title: 'Sony PlayStation 5', description: 'Predám PS5, lebo miesto nej kúpim PS6.' },
  { title: 'Sony PlayStation 5', description: 'Ak sa niekto zbavujete konzoly, ozvite sa. Mám na ňu 300 eur.' },
  { title: 'PS5 Slim', description: 'Dobrý deň, kúpim konzolu s ovládačom.' },
]

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('keeps a sale that mentions another purchase when the model is offline', async () => {
  vi.stubEnv('LISTING_MODEL_PORT', '')
  expect(await detectWantedListings(listings)).toEqual([false, false, true])
})

it('uses the local model for indirect buyer intent and preserves input order', async () => {
  vi.stubEnv('LISTING_MODEL_PORT', '5056')
  const fetchModel = vi.fn(async () => Response.json({
    choices: [{ message: { content: '{"wanted":[0,1]}' } }],
  }))
  vi.stubGlobal('fetch', fetchModel)
  expect(await detectWantedListings(listings)).toEqual([false, true, true])
  expect(fetchModel).toHaveBeenCalledWith('http://127.0.0.1:5056/v1/chat/completions', expect.anything())
  expect(await detectWantedListings(listings)).toEqual([false, true, true])
  expect(fetchModel).toHaveBeenCalledTimes(1)
})
