import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import ipaddr from 'ipaddr.js'
import { safeUrl } from './importer'

export const maxCatalogBytes = 1_000_000

export class CatalogHttpError extends Error {
  constructor(readonly status: number, readonly location?: string) {
    super('Zdroj vrátil stav HTTP ' + status + '.')
  }
}

export function sourceUrl(raw: string, host?: string) {
  const url = safeUrl(raw, host)
  if (!url || new URL(url).hash) {
    throw Error(
      'Zdroj musí byť verejná adresa HTTPS bez prihlasovacích údajov v URL.',
    )
  }
  return new URL(url)
}

export function isPublicAddress(address: string) {
  return (
    ipaddr.isValid(address) && ipaddr.process(address).range() === 'unicast'
  )
}

export async function readCatalogUrl(url: URL, accept: string, maxBytes = maxCatalogBytes) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 5_000_000)
    throw Error('Neplatný limit veľkosti odpovede zdroja.')
  const signal = AbortSignal.timeout(12000)
  const addresses = await lookup(url.hostname, { all: true }).catch(() => [])
  const address =
    addresses.find((result) => result.family === 4) ?? addresses[0]
  if (
    !address ||
    addresses.some((result) => !isPublicAddress(result.address))
  ) {
    throw Error('Doménu zdroja sa nepodarilo overiť ako verejnú.')
  }

  // Connect to the vetted address while authenticating the configured hostname.
  return new Promise<string>((resolve, reject) => {
    const req = request(
      {
        hostname: address.address,
        family: address.family,
        servername: url.hostname,
        path: url.pathname + url.search,
        headers: {
          Host: url.hostname,
          Accept: accept,
          'Accept-Encoding': 'identity',
          'User-Agent': 'PriceFinder Merchant Sync/1.0',
        },
        agent: false,
        signal,
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.destroy()
          reject(new CatalogHttpError(res.statusCode ?? 0, res.headers.location))
          return
        }
        if (
          (res.headers['content-encoding'] &&
            res.headers['content-encoding'] !== 'identity') ||
          Number(res.headers['content-length']) > maxBytes
        ) {
          res.destroy()
          reject(
            Error('Odpoveď zdroja musí byť nekomprimovaná a mať najviac ' + maxBytes + ' bajtov.'),
          )
          return
        }

        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > maxBytes) {
            reject(Error('Odpoveď zdroja môže mať najviac ' + maxBytes + ' bajtov.'))
            res.destroy()
            return
          }
          chunks.push(chunk)
        })
        res.once('end', () => {
          try {
            resolve(
              new TextDecoder('utf-8', { fatal: true }).decode(
                Buffer.concat(chunks),
              ),
            )
          } catch {
            reject(Error('Zdroj musí používať kódovanie UTF-8.'))
          }
        })
        res.once('error', () =>
          reject(Error('Sťahovanie zdroja bolo prerušené.')),
        )
      },
    )
    req.once('error', () =>
      reject(Error('Spojenie so zdrojom zlyhalo alebo vypršal časový limit.')),
    )
    req.end()
  })
}
