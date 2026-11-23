import 'dotenv/config'
import { db } from '../lib/db'
import { liveProviderName, liveSearch } from '../lib/live-search'

async function run() {
  const query = process.argv.slice(2).join(' ').trim() || 'playstation 5'
  const results = await liveSearch(query)
  if (!results.length) throw Error('Nie sú nastavené žiadne živé zdroje.')
  console.table(results.map((result) => ({
    source: liveProviderName[result.provider],
    status: result.status,
    offers: result.rows.length,
    photos: result.rows.filter((row) => row.image).length,
  })))
  console.log('Ponúk spolu: ' + results.reduce((count, result) => count + result.rows.length, 0))
  if (results.some((result) => ['unavailable', 'blocked'].includes(result.status))) process.exitCode = 1
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Kontrola zdrojov zlyhala.')
  process.exitCode = 1
}).finally(() => db.$disconnect())
