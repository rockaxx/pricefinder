import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { closeSync, openSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
const requireFromProject = createRequire(resolve('package.json'))
const configured = process.env.DATABASE_URL
if (!configured?.startsWith('file:'))
  throw Error('Set DATABASE_URL to a SQLite file URL in .env.')
const filename = configured.slice(5)
const database = resolve('prisma', filename)
// Ensure the file exists before Prisma's Windows migration engine opens it.
closeSync(openSync(database, 'a'))
const prisma = requireFromProject.resolve('prisma/build/index.js')
const child = spawnSync(process.execPath, [prisma, 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: 'file:' + database.replaceAll('\\', '/'),
  },
})
if (child.error) throw child.error
process.exitCode = child.status ?? 1
