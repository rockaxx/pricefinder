import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { db } from '../lib/db'
import { importFeed } from '../lib/importer'
import { connectorFor, merchantSyncConfig } from '../lib/remote-catalog'

const sourcesSchema = z.record(
  z.string().regex(/^[a-z0-9-]+$/),
  merchantSyncConfig,
)

async function run() {
  const path = process.env.MERCHANT_SYNC_CONFIG || 'merchant-sync.local.json'
  let data: unknown
  try {
    data = JSON.parse(await readFile(path, 'utf8'))
  } catch {
    throw Error('Konfiguračný súbor sa nepodarilo načítať ako JSON.')
  }

  const result = sourcesSchema.safeParse(data)
  if (!result.success)
    throw Error(
      'Neplatná konfigurácia zdrojov. Skontroluj formát a schválenie zdroja.',
    )
  const [requested, ...extra] = process.argv.slice(2)
  if (extra.length || (requested && !Object.hasOwn(result.data, requested))) {
    throw Error('Použi npm run sync:catalog -- [identifikátor zdroja].')
  }
  const sources = Object.entries(result.data).filter(
    ([id]) => !requested || id === requested,
  )
  if (!sources.length)
    throw Error('V konfigurácii nie je žiadny schválený zdroj.')

  for (const [id, settings] of sources) {
    try {
      const source = await db.dataSource.findUnique({
        where: { id },
        include: { merchant: true },
      })
      if (!source?.enabled || source.demo || !source.merchant?.host) {
        throw Error(
          'Zdroj musí byť zapnutý a priradený k registrovanému obchodu.',
        )
      }
      const connector = connectorFor(settings, source.merchant.host)
      if (source.kind !== connector.format)
        throw Error('Formát synchronizácie sa nezhoduje s formátom zdroja.')
      const count = await importFeed(id, connector)
      console.info(id + ': importovaných položiek: ' + count)
    } catch (error) {
      console.error(
        id +
          ': ' +
          (error instanceof Error && error.name === 'Error'
            ? error.message
            : 'Synchronizácia zlyhala. Skontroluj denník importov.'),
      )
      process.exitCode = 1
    }
  }
}

run()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Synchronizácia zlyhala.',
    )
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
