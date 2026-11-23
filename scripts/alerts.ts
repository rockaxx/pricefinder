import 'dotenv/config'
import { evaluateAlerts } from '../lib/alerts'
import { db } from '../lib/db'
evaluateAlerts(process.argv.includes('--log'))
  .then(console.info)
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
