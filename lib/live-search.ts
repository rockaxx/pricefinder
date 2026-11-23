import { z } from 'zod'
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from './db'
import { CatalogHttpError, sourceUrl, readCatalogUrl } from './catalog-http'
import {
  extractBazosListings,
  extractLocalAlzaListings,
  type LocalListing,
} from './local-listings'

const providers = ['alza', 'bazos'] as const
type Provider = (typeof providers)[number]
export const liveProviderName = { alza: 'Alza.sk', bazos: 'Bazoš.sk' }
type Settings = {
  endpoint: string
  queryParam: string
  minIntervalMs: number
  maxPerMinute: number
  maxPerDay: number
  refreshMs: number
  imagesAllowed?: boolean
  unlimited?: boolean
}
type Reserve = (
  provider: Provider,
  queryKey: string,
  now: number,
  limits: Settings,
) => Promise<boolean>
type Retain = (
  provider: Provider,
  rows: LocalListing[],
  now: number,
  refreshMs: number,
) => Promise<LocalListing[]>
const hour = 3_600_000
const day = 86_400_000
type Result = {
  provider: Provider
  status: 'live' | 'limited' | 'unavailable' | 'blocked'
  rows: LocalListing[]
}

const schema = z.object({
  endpoint: z.string().max(2048).url(),
  queryParam: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .max(100),
  minIntervalMs: z.number().int().min(1000),
  maxPerMinute: z.number().int().positive(),
  maxPerDay: z.number().int().positive(),
  refreshMs: z.number().int().min(hour),
  imagesAllowed: z.boolean().optional(),
  unlimited: z.boolean().optional(),
})
const validHost = (host: string, provider: Provider) => {
  const domain = provider + '.sk'
  return provider === 'alza'
    ? host === 'www.alza.sk'
    : host === domain || host.endsWith('.' + domain)
}

export function makeLiveSearch(
  config: Partial<Record<Provider, Settings>>,
  read = readCatalogUrl,
  reserve?: Reserve,
  retain?: Retain,
) {
  const sources = providers.flatMap((provider) => {
    const parsed = schema.safeParse(config[provider])
    if (!parsed.success) return []
    const settings = parsed.data
    try {
      const endpoint = sourceUrl(settings.endpoint)
      if (!validHost(endpoint.hostname, provider)) return []
      return [
        {
          provider,
          settings,
          endpoint,
          cache: new Map<
            string,
            {
              expires: number
              result: Promise<Result>
            }
          >(),
          nextRequest: 0,
          blockedUntil: 0,
          sent: [] as number[],
        },
      ]
    } catch {
      return []
    }
  })

  return async (raw: string): Promise<Result[]> => {
    const query = raw.trim().slice(0, 100)
    if (!query) return []
    return Promise.all(
      sources.map((source) => {
        const { provider, settings, cache } = source
        const now = Date.now()
        const queryKey = query.toLowerCase().replace(/\s+/g, ' ')
        const cached = cache.get(queryKey)
        if (cached && cached.expires > now) return cached.result
        if (source.blockedUntil > now)
          return { provider, status: 'blocked', rows: [] }
        if (!settings.unlimited) {
          source.sent = source.sent.filter((time) => time > now - day)
          if (
            source.nextRequest > now ||
            source.sent.length >= settings.maxPerDay ||
            source.sent.filter((time) => time > now - 60_000).length >=
              settings.maxPerMinute
          )
            return { provider, status: 'limited', rows: [] }
          source.nextRequest = now + settings.minIntervalMs
          source.sent.push(now)
        }
        const url = new URL(source.endpoint)
        url.searchParams.set(settings.queryParam, query)
        const result = (async (): Promise<Result> => {
          try {
            if (
              !settings.unlimited &&
              reserve &&
              !(await reserve(provider, queryKey, now, settings))
            ) {
              cache.delete(queryKey)
              source.sent = source.sent.filter((time) => time !== now)
              return { provider, status: 'limited', rows: [] }
            }
            const html = await read(url, 'text/html,application/xhtml+xml')
            const parse =
              provider === 'alza'
                ? extractLocalAlzaListings
                : extractBazosListings
            // Without a supported result card, the response may be an error page.
            const rows = parse(html)
              .slice(0, 60)
              .map((row) => ({
                ...row,
                image: settings.imagesAllowed ? row.image : null,
              }))
            const observed =
              !settings.unlimited && retain && rows.length
                ? await retain(provider, rows, now, settings.refreshMs)
                : rows
            return {
              provider,
              status: rows.length ? 'live' : 'unavailable',
              rows: settings.imagesAllowed
                ? observed
                : observed.map((row) => ({ ...row, image: null })),
            }
          } catch (error) {
            if (error instanceof CatalogHttpError && error.status === 403) {
              source.blockedUntil = Date.now() + settings.refreshMs
              return { provider, status: 'blocked', rows: [] }
            }
            return { provider, status: 'unavailable', rows: [] }
          }
        })().finally(() => {
          if (settings.unlimited) cache.delete(queryKey)
        })
        for (const [key, value] of cache)
          if (value.expires <= now) cache.delete(key)
        cache.set(queryKey, {
          expires: settings.unlimited ? Infinity : now + settings.refreshMs,
          result,
        })
        return result
      }),
    )
  }
}

const settings = (
  prefix: string,
  maxPerMinute: number,
  maxPerDay: number,
): Settings => ({
  endpoint: process.env[prefix + '_SEARCH_ENDPOINT'] || '',
  queryParam: process.env[prefix + '_SEARCH_QUERY_PARAM'] || '',
  minIntervalMs: Number(process.env[prefix + '_SEARCH_INTERVAL_MS']),
  maxPerMinute,
  maxPerDay,
  refreshMs: hour,
  imagesAllowed: imagesAllowed(prefix === 'ALZA' ? 'alza' : 'bazos'),
  unlimited: prefix === 'BAZOS' && process.env.BAZOS_SEARCH_UNLIMITED === '1',
})

export function imagesAllowed(provider: Provider) {
  return process.env[provider.toUpperCase() + '_SEARCH_IMAGES_ALLOWED'] === '1'
}

export const reserveRequest: Reserve = async (
  provider,
  queryKey,
  now,
  limits,
) => {
  const key = createHash('sha256').update(queryKey).digest('hex')
  const retention = Math.max(day, limits.refreshMs, limits.minIntervalMs)
  await db.$executeRaw`DELETE FROM "LiveSearchRequest" WHERE "provider" = ${provider} AND "atMs" <= ${BigInt(now - retention)}`
  const count = await db.$executeRaw`
    INSERT INTO "LiveSearchRequest" ("provider", "queryKey", "atMs")
    SELECT ${provider}, ${key}, ${BigInt(now)}
    WHERE
      (SELECT COUNT(*) FROM "LiveSearchRequest" WHERE "provider" = ${provider} AND "atMs" > ${BigInt(now - day)}) < ${limits.maxPerDay}
      AND (SELECT COUNT(*) FROM "LiveSearchRequest" WHERE "provider" = ${provider} AND "atMs" > ${BigInt(now - 60_000)}) < ${limits.maxPerMinute}
      AND NOT EXISTS (SELECT 1 FROM "LiveSearchRequest" WHERE "provider" = ${provider} AND "atMs" > ${BigInt(now - limits.minIntervalMs)})
      AND NOT EXISTS (SELECT 1 FROM "LiveSearchRequest" WHERE "provider" = ${provider} AND "queryKey" = ${key} AND "atMs" > ${BigInt(now - limits.refreshMs)})
  `
  return count === 1
}

export const retainListings: Retain = async (
  provider,
  rows,
  now,
  refreshMs,
) => {
  const minimum = BigInt(now - refreshMs)
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM "LiveListingCache" WHERE "provider" = ${provider} AND "atMs" <= ${minimum}`
    const values = Prisma.join(
      rows.map(
        (row) =>
          Prisma.sql`(${provider}, ${row.id}, ${BigInt(now)}, ${JSON.stringify(row)})`,
      ),
    )
    await tx.$executeRaw`
      INSERT INTO "LiveListingCache" ("provider", "externalId", "atMs", "payload")
      VALUES ${values}
      ON CONFLICT ("provider", "externalId") DO NOTHING
    `
    const stored = await tx.$queryRaw<
      { externalId: string; payload: string }[]
    >`
      SELECT "externalId", "payload" FROM "LiveListingCache"
      WHERE "provider" = ${provider} AND "externalId" IN (${Prisma.join(rows.map((row) => row.id))})
    `
    const byId = new Map(
      stored.map((row) => [
        row.externalId,
        JSON.parse(row.payload) as LocalListing,
      ]),
    )
    return rows.map((row) => {
      const stored = byId.get(row.id)
      return stored ? { ...stored, image: row.image ?? stored.image } : row
    })
  })
}

export const liveSearch = makeLiveSearch(
  {
    alza: settings('ALZA', 50, 1000),
    bazos: settings('BAZOS', 60, 300),
  },
  readCatalogUrl,
  reserveRequest,
  retainListings,
)
