import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { parseArgs } from 'node:util'
import { HttpCrawler } from '@crawlee/http'
import { Configuration, log, LogLevel } from '@crawlee/core'
import { alzaPs5Page, extractAlzaListings } from '../lib/alza-listings'

async function run() {
  const { values } = parseArgs({
    options: {
      html: { type: 'string' },
      'live-authorized': { type: 'boolean' },
    },
  })
  const live = values['live-authorized'] ?? false
  if (live === Boolean(values.html))
    throw Error('Použi --html CESTA alebo --live-authorized pre povolený zber.')
  log.setLevel(LogLevel.OFF)

  const html = values.html ? await readFile(values.html, 'utf8') : null
  if (html !== null && Buffer.byteLength(html) > 5_000_000)
    throw Error('Snímka HTML môže mať najviac 5 MB.')
  // Feed a saved page to the same Crawlee handler without contacting the merchant.
  const server =
    html === null
      ? null
      : createServer((_req, res) => {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
        })
  try {
    let target = alzaPs5Page
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
      })
      const address = server.address()
      if (!address || typeof address === 'string')
        throw Error('Lokálna snímka sa nedá spracovať.')
      target = 'http://127.0.0.1:' + address.port + '/'
    }

    let products: ReturnType<typeof extractAlzaListings> = []
    const crawler = new HttpCrawler(
      {
        maxRequestsPerCrawl: 1,
        maxConcurrency: 1,
        maxRequestRetries: 0,
        requestHandlerTimeoutSecs: 15,
        navigationTimeoutSecs: 15,
        useSessionPool: false,
        retryOnBlocked: false,
        respectRobotsTxtFile: live ? { userAgent: 'PriceFinder' } : false,
        preNavigationHooks: [
          (_context, options) => {
            options.followRedirect = false
            options.useHeaderGenerator = false
            options.headers = {
              ...options.headers,
              'user-agent': 'PriceFinder/1.0',
            }
          },
        ],
        async requestHandler({ body, response }) {
          if (response?.statusCode === 200)
            products = extractAlzaListings(body.toString())
        },
      },
      new Configuration({ persistStorage: false, logLevel: LogLevel.OFF }),
    )
    const result = await crawler.run([target])
    if (!products.length)
      throw Error(
        result.requestsFailed
          ? 'Stránku sa nepodarilo načítať cez Crawlee.'
          : 'Stránka bola preskočená alebo neobsahuje rozpoznateľnú produktovú kartu s cenou v EUR.',
      )
    console.log(
      JSON.stringify(
        {
          merchant: 'Alza.sk',
          source: alzaPs5Page,
          mode: live ? 'live' : 'supplied-html',
          observedAt: live ? new Date().toISOString() : null,
          products,
        },
        null,
        2,
      ),
    )
  } finally {
    server?.close()
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Zber zlyhal.')
  process.exitCode = 1
})
