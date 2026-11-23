import 'dotenv/config'
import { z } from 'zod'
import { db } from '../lib/db'
import { safeUrl } from '../lib/importer'
import snapshot from '../exports/alza-ps5-snapshot.json'

async function run() {
  const site = new URL(process.env.SITE_URL || 'http://localhost:3000')
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(site.hostname) ||
    !process.env.DATABASE_URL?.startsWith('file:')
  ) {
    throw Error('Import snímky je určený pre lokálnu SQLite databázu.')
  }
  const [row] = z
    .array(
      z.object({
        code: z.literal('MSX0052nad'),
        name: z.string().min(1).max(150),
        url: z.string().url(),
        currency: z.literal('EUR'),
        priceCents: z.number().int().positive(),
        priceLabel: z.null(),
        availability: z.literal('Skladom podľa variantu'),
      }),
    )
    .length(1)
    .parse(snapshot.products)
  const url = safeUrl(row.url, 'www.alza.sk')
  if (
    !url ||
    snapshot.observedAt !== null ||
    snapshot.mode !== 'supplied-html'
  ) {
    throw Error('Snímka nemá očakávaný zdroj alebo formát.')
  }

  const merchantId = 'merchant-www-alza-sk'
  const sourceId = 'www-alza-sk-local-snapshot'
  const productId = 'alza-playstation-5-slim-1tb-disc'
  await db.$transaction(async (tx) => {
    await tx.category.upsert({
      where: { id: 'konzoly' },
      update: {},
      create: { id: 'konzoly', name: 'Herné konzoly' },
    })
    await tx.merchant.upsert({
      where: { id: merchantId },
      update: {},
      create: { id: merchantId, name: 'Alza.sk', host: 'www.alza.sk' },
    })
    await tx.dataSource.upsert({
      where: { id: sourceId },
      update: { enabled: true },
      create: {
        id: sourceId,
        name: 'Alza.sk · lokálna snímka',
        kind: 'snapshot',
        merchantId,
        enabled: true,
      },
    })
    const catalogProduct = {
      name: 'Sony ' + row.name,
      brand: 'Sony',
      model: 'PlayStation 5 Slim',
      variant: '1 TB · s mechanikou',
      storage: '1 TB',
      categoryId: 'konzoly',
      images: [],
      specs: { Výrobca: 'Sony', Úložisko: '1 TB', Mechanika: 'Blu-ray' },
    }
    await tx.product.upsert({
      where: { id: productId },
      update: catalogProduct,
      create: { id: productId, ...catalogProduct },
    })
    const data = {
      productId,
      merchantId,
      title: row.name,
      url,
      price: row.priceCents,
      shipping: null,
      condition: 'unknown',
      availability: 'unknown',
      reviewed: true,
      listing: { reportedAvailability: row.availability, observedAt: null },
    }
    await tx.offer.upsert({
      where: { sourceId_externalId: { sourceId, externalId: row.code } },
      create: { sourceId, externalId: row.code, ...data },
      update: data,
    })
    await tx.dataSource.updateMany({
      where: { demo: true },
      data: { enabled: false },
    })
  })
  console.log(
    'Ponuka Alzy zo snímky je v lokálnom katalógu. Ukážkové zdroje sú vypnuté.',
  )
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
