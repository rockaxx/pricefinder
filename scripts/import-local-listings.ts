import 'dotenv/config'
import { readFile, stat } from 'node:fs/promises'
import { db } from '../lib/db'
import {
  extractBazosListings,
  extractLocalAlzaListings,
} from '../lib/local-listings'
import { localSearchMode } from '../lib/local-search-mode'

async function run() {
  const [provider, file, ...extra] = process.argv.slice(2)
  if ((provider !== 'alza' && provider !== 'bazos') || !file || extra.length) {
    throw Error('Použi npm run local:import -- alza|bazos CESTA_K_HTML.')
  }
  if (!localSearchMode() || !process.env.DATABASE_URL?.startsWith('file:')) {
    throw Error('Import je dostupný len v lokálnom režime so SQLite.')
  }
  if ((await stat(file)).size > 5_000_000)
    throw Error('HTML môže mať najviac 5 MB.')
  const html = await readFile(file, 'utf8')
  const rows = (
    provider === 'alza' ? extractLocalAlzaListings : extractBazosListings
  )(html)
  if (!rows.length)
    throw Error('Súbor neobsahuje rozpoznateľné produkty s cenou v EUR.')

  const merchantHost = provider === 'alza' ? 'www.alza.sk' : 'bazos.sk'
  const merchantId =
    provider === 'alza' ? 'merchant-www-alza-sk' : 'merchant-bazos-sk'
  const sourceId =
    provider === 'alza'
      ? 'www-alza-sk-local-snapshot'
      : 'bazos-sk-local-snapshot'
  const name = provider === 'alza' ? 'Alza.sk' : 'Bazoš.sk'
  await db.$transaction(
    async (tx) => {
      await tx.merchant.upsert({
        where: { id: merchantId },
        update: {},
        create: { id: merchantId, name, host: merchantHost },
      })
      await tx.dataSource.upsert({
        where: { id: sourceId },
        update: { enabled: true },
        create: {
          id: sourceId,
          name: name + ' · lokálna snímka',
          kind: 'snapshot',
          enabled: true,
          merchantId,
        },
      })
      for (const row of rows) {
        const data = {
          title: row.name,
          price: row.priceCents,
          url: row.url,
          availability: 'unknown',
          condition: 'unknown',
          listing: {
            image: row.image,
            priceLabel: row.priceLabel ?? null,
            ...(row.description && { description: row.description }),
          },
        }
        await tx.offer.upsert({
          where: { sourceId_externalId: { sourceId, externalId: row.id } },
          update: data,
          create: { ...data, sourceId, externalId: row.id, merchantId },
        })
      }
      await tx.dataSource.updateMany({
        where: { demo: true },
        data: { enabled: false },
      })
    },
    { timeout: 30000 },
  )
  console.log(name + ': uložených ponúk: ' + rows.length)
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Import zlyhal.')
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
