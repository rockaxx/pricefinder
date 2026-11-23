import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const temp = resolve(tmpdir())
const directory = mkdtempSync(join(temp, 'pricefinder-e2e-'))
const requireFromProject = createRequire(resolve('package.json'))
const tsx = requireFromProject.resolve('tsx/cli')
const playwright = requireFromProject.resolve('@playwright/test/cli')
const env = {
  ...process.env,
  DATABASE_URL: 'file:' + join(directory, 'catalog.db').replaceAll('\\', '/'),
}
function run(entry: string, args: string[]) {
  const child = spawnSync(process.execPath, [entry, ...args], {
    env,
    stdio: 'inherit',
  })
  if (child.error) throw child.error
  return child.status ?? 1
}
try {
  process.exitCode =
    run(tsx, ['scripts/setup.ts']) ||
    run(tsx, ['prisma/seed.ts']) ||
    run(playwright, ['test', ...process.argv.slice(2)])
} finally {
  if (dirname(directory) === temp)
    rmSync(directory, { recursive: true, force: true, maxRetries: 3 })
}
