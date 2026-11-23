import { setTimeout as delay } from 'node:timers/promises'
import { CatalogHttpError, readCatalogUrl, sourceUrl } from './catalog-http'

export async function readSearchUrl(initial: URL, accept: string) {
  let url = sourceUrl(initial.href)
  const host = url.hostname.replace(/^www\./, '')
  const visited = new Set<string>()
  for (let hop = 0; hop < 4; hop++) {
    if (url.hostname.replace(/^www\./, '') !== host || visited.has(url.href))
      throw Error('Vyhľadávanie presmerovalo mimo obchodu alebo vytvorilo slučku.')
    visited.add(url.href)
    try {
      const html = await readCatalogUrl(url, accept, 5_000_000)
      // Some FastCentrik searches return a static category redirect instead of HTTP 3xx.
      const redirect = /<script[^>]*>\s*document\.location\.href\s*=\s*['"]([^'"\r\n]+)['"]\s*;?\s*<\/script>/i.exec(html)
      if (!redirect) return html
      url = sourceUrl(new URL(redirect[1], url).href)
    } catch (error) {
      if (!(error instanceof CatalogHttpError) || ![301, 302, 303, 307, 308].includes(error.status) || !error.location)
        throw error
      url = sourceUrl(new URL(error.location, url).href)
    }
    await delay(1000)
  }
  throw Error('Vyhľadávanie prekročilo povolený počet presmerovaní.')
}
