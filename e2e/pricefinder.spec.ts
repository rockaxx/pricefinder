import { test, expect } from '@playwright/test'
import { db } from '../lib/db'
import { evaluateAlerts } from '../lib/alerts'
import { importFeed } from '../lib/importer'
import { connectorFor, merchantSyncConfig } from '../lib/remote-catalog'
import { reserveRequest, retainListings, resultCache } from '../lib/live-search'
const id = 'sony-playstation-5-slim-disc-1tb'
test('search, filter, compare, follow a merchant link, and create a price alert', async ({
  page,
  request,
}) => {
  await page.goto('/')
  await page
    .getByRole('textbox', { name: 'Názov produktu' })
    .fill('PlayStation 5')
  await expect(
    page.getByRole('list', { name: 'Návrhy produktov' }).getByRole('link'),
  ).toHaveCount(3)
  await page.getByRole('button', { name: 'Vyhľadať' }).click()
  await expect(page.getByRole('article')).toHaveCount(3)
  await page.getByLabel('Stav', { exact: true }).selectOption('used')
  await page.getByRole('button', { name: 'Použiť filtre' }).click()
  await expect(page.getByRole('article')).toHaveCount(1)
  await page.getByRole('article').getByRole('link').filter({
    has: page.getByRole('heading', { name: 'PlayStation 5 Slim', exact: true }),
  }).click()
  await page.waitForURL('**/produkt/' + id)
  await expect(
    page.getByRole('heading', { name: 'Sony PlayStation 5 Slim Disc 1 TB' }),
  ).toBeVisible()
  await page.getByLabel('Zoradiť', { exact: true }).selectOption('total')
  await page.getByRole('button', { name: 'Zoradiť ponuky' }).click()
  const offers = page.locator('.offer')
  await expect(offers.first()).toContainText('Demo bazár')
  await expect(offers.last()).toContainText('Neznáme')
  const href = await offers
    .first()
    .getByRole('link', { name: 'Demo odkaz' })
    .getAttribute('href')
  const response = await request.get(href!, { maxRedirects: 0 })
  expect(response.status()).toBe(302)
  expect(response.headers().location).toMatch(/^https:\/\/example\.com\//)
  const email = 'e2e-' + Date.now() + '@example.com'
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Cieľová cena (€)').fill('380')
  await page.getByRole('button', { name: 'Vytvoriť upozornenie' }).click()
  await expect(page.getByRole('status')).toContainText('Upozornenie uložené')
  try {
    await evaluateAlerts(true)
    const alert = await db.priceAlert.findFirst({
      where: { email, productId: id },
    })
    expect(alert?.channel).toBe('log')
  } finally {
    await db.priceAlert.deleteMany({ where: { email } })
  }
})
test('protected sample import stores observable history', async ({ page }) => {
  await page.goto('/admin')
  await expect(
    page.getByRole('button', { name: 'Importovať ukážkové XML' }),
  ).toHaveCount(0)
  await page
    .getByLabel('Prístupový kľúč')
    .fill('pricefinder-e2e-local-token-only')
  await page.getByRole('button', { name: 'Prihlásiť sa' }).click()
  await page.getByRole('button', { name: 'Importovať ukážkové XML' }).click()
  await expect(page.getByRole('status')).toContainText('Operácia dokončená')
  await page.goto('/produkt/' + id)
  await expect(page.getByText('DEMO pozorovania z importu')).toBeVisible()
  await page.getByText('Zobraziť zaznamenané ceny').click()
  await expect(page.locator('.chart ul li').first()).toContainText('459,00')
})
test('mobile theme, deal filters and meaningful category navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Nájdi najlepšiu cenu',
  )
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375)
  await page.getByRole('button', { name: 'Prepnúť farebný režim' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('link', { name: 'Herné konzoly', exact: true }).press('Enter')
  await page.waitForURL('**/kategoria/konzoly')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Herné konzoly',
  )
  await expect(page.getByRole('article')).toHaveCount(6)
  await page.getByRole('link', { name: 'Ponuky', exact: true }).click()
  await page.locator('select[name=category]').selectOption('konzoly')
  await page.locator('select[name=condition]').selectOption('used')
  await page.getByRole('button', { name: 'Použiť filtre' }).click()
  await expect(page.getByRole('article').first()).toContainText(
    'Nedostatok údajov na hodnotenie.',
  )
  await expect(page.getByRole('article').first()).toContainText('Použité')
})
test('approved CSV uploads stage unmatched listings and support manual catalog approval', async ({
  page,
}) => {
  await page.goto('/admin')
  await page
    .getByLabel('Prístupový kľúč')
    .fill('pricefinder-e2e-local-token-only')
  await page.getByRole('button', { name: 'Prihlásiť sa' }).click()
  await page.getByLabel('Názov obchodu').fill('Testovací obchod')
  await page.getByLabel('Presná doména obchodu').fill('example.com')
  await page.getByLabel('Formát').selectOption('csv')
  await page.getByRole('button', { name: 'Pridať zdroj' }).click()
  const row = page.locator('.admin-row').filter({ hasText: 'Testovací obchod' })
  await row.locator('input[type=file]').setInputFiles({
    name: 'catalog.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'ITEM_ID,PRODUCTNAME,MANUFACTURER,URL,PRICE_VAT,SHIPPING,AVAILABILITY\nexample-1,Apple iPhone 16 128 GB,Apple,https://example.com/phone,319.00,3.50,in',
    ),
  })
  await row.getByRole('button', { name: 'Importovať', exact: true }).click()
  await expect(page.getByText('Zhoda 0 %')).toBeVisible()
  await page.getByText('Vytvoriť nový produkt').click()
  const review = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Vytvoriť a priradiť' }) })
  await review.getByLabel('Značka').fill('Apple')
  await review.getByLabel('Model').fill('iPhone 16')
  await review.getByLabel('Variant').fill('128 GB')
  await review.locator('select').selectOption('mobily')
  await review.getByRole('button', { name: 'Vytvoriť a priradiť' }).click()
  await expect(page.getByText('Zhoda 0 %')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('Operácia dokončená')
  await page.goto('/produkt/real-apple-iphone-16-128gb')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Apple iPhone 16 128 GB',
  )
  await expect(page.locator('.offer')).toContainText('322,50')
  await expect(
    page.getByRole('link', { name: 'Prejsť do obchodu' }),
  ).toBeVisible()
  await page.goto('/vyhladavanie?q=iPhone+16&origin=real')
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('article')).toContainText('322,50')
})
test('product page sync records price changes without expiring other listings', async () => {
  const sourceId = 'pages-test'
  const merchant = await db.merchant.create({
    data: { id: sourceId, name: 'Product feed fixture', host: 'example.net' },
  })
  await db.dataSource.create({
    data: {
      id: sourceId,
      name: merchant.name,
      kind: 'csv',
      enabled: true,
      merchantId: merchant.id,
    },
  })
  const urls = ['https://example.net/disc', 'https://example.net/digital']
  const run = (selected: string[], price: string) =>
    importFeed(
      sourceId,
      connectorFor(
        merchantSyncConfig.parse({
          mode: 'pages',
          authorized: true,
          urls: selected,
        }),
        'example.net',
        async (url) =>
          `<script type="application/ld+json">${JSON.stringify({
            '@type': 'Product',
            name: 'Console ' + url.pathname.slice(1),
            sku: url.pathname.slice(1),
            offers: {
              '@type': 'Offer',
              priceCurrency: 'EUR',
              price,
              availability: 'InStock',
            },
          })}</script>`,
      ),
    )
  expect(await run(urls, '400.00')).toBe(2)
  expect(await run(urls.slice(0, 1), '399.99')).toBe(1)
  const offers = await db.offer.findMany({
    where: { sourceId },
    include: { history: { orderBy: { observed: 'asc' } } },
    orderBy: { externalId: 'asc' },
  })
  expect(
    offers.map(({ price, availability }) => ({ price, availability })),
  ).toEqual([
    { price: 40000, availability: 'in' },
    { price: 39999, availability: 'in' },
  ])
  expect(offers[1].history.map((o) => o.price)).toEqual([40000, 39999])
})
test('SQLite keeps live search limits and the hourly listing price window', async () => {
  const now = Date.now()
  const limits = {
    endpoint: 'https://www.bazos.sk/search.php',
    queryParam: 'hledat',
    maxPerDay: 2,
    maxPerMinute: 1,
    minIntervalMs: 1000,
    refreshMs: 3600000,
  }
  const reserve = (query: string, elapsed: number) =>
    reserveRequest('bazos', query, now + elapsed, limits)
  expect(await reserve('ps5', 0)).toBe(true)
  expect(await reserve('xbox', 2000)).toBe(false)
  expect(await reserve('ps5', 61000)).toBe(false)
  expect(await reserve('xbox', 61000)).toBe(true)
  expect(await reserve('macbook', 3601000)).toBe(false)
  expect(await reserve('macbook', 86401000)).toBe(true)
  const row = {
    id: '1',
    name: 'PS5',
    priceCents: 1000,
    url: 'https://www.bazos.sk/inzerat/1/ps5.php',
    image: null,
  }
  const observePrice = async (priceCents: number, elapsed: number) =>
    (
      await retainListings(
        'bazos',
        [{ ...row, priceCents }],
        now + elapsed,
        limits.refreshMs,
      )
    )[0].priceCents
  expect(await observePrice(1000, 0)).toBe(1000)
  expect(await observePrice(1200, 2000)).toBe(1000)
  expect(await observePrice(1200, 3601000)).toBe(1200)
  await resultCache.set('bazos', 'cached-query', [row], now)
  expect(await resultCache.get('bazos', 'cached-query', now + 1000, 3600000))
    .toEqual({ rows: [row], expires: now + 3600000 })
  expect(await resultCache.get('bazos', 'cached-query', now + 3600000, 3600000))
    .toBeNull()
})
test.afterAll(async () => {
  await db.$disconnect()
})
