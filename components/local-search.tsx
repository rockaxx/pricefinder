import Link from 'next/link'
import Image from 'next/image'
import { db } from '../lib/db'
import { euro, relevance } from '../lib/domain'
import { listingPhoto, providerSearchLinks } from '../lib/local-listings'
import { imagesAllowed, liveProviderName, liveSearch } from '../lib/live-search'
import { SearchBox } from './search-box'

const pageSize = 24

export async function LocalSearch({
  query = '',
  page = 1,
}: {
  query?: string
  page?: number
}) {
  const q = query.trim().slice(0, 100)
  const [offers, remote] = await Promise.all([
    db.offer.findMany({
      where: {
        source: { enabled: true, demo: false },
        availability: { not: 'out' },
      },
      select: {
        id: true,
        title: true,
        price: true,
        url: true,
        listing: true,
        merchant: { select: { name: true } },
      },
    }),
    liveSearch(q),
  ])
  const live = remote.filter((result) => result.status === 'live')
  const liveNames = new Set(
    live.map((result) => liveProviderName[result.provider]),
  )
  const snapshots = offers
    .filter((offer) => !liveNames.has(offer.merchant.name))
    .map((offer) => ({
      ...offer,
      score: relevance(q, offer.title),
      live: false,
    }))
    .filter((offer) => offer.score > 0)
  const currentOffers = live.flatMap(({ provider, rows }) =>
    rows.map((row) => ({
      id: provider + ':' + row.id,
      title: row.name,
      url: row.url,
      price: row.priceCents,
      listing: { priceLabel: row.priceLabel ?? null, image: row.image },
      merchant: { name: liveProviderName[provider] },
      score: Math.max(1, relevance(q, row.name)),
      live: true,
    })),
  )
  const matches = [...currentOffers, ...snapshots].sort(
    (a, b) =>
      b.score - a.score || a.price - b.price || a.id.localeCompare(b.id),
  )
  const pages = Math.max(1, Math.ceil(matches.length / pageSize))
  const current = Math.min(pages, Math.max(1, page || 1))
  const pageUrl = (next: number) =>
    '/vyhladavanie?' + new URLSearchParams({ q, page: String(next) })

  return (
    <section className="section">
      <h1>{q ? 'Výsledky pre „' + q + '“' : 'Vyhľadaj ponuky'}</h1>
      <SearchBox initial={q} suggestions={false} />
      {q && (
        <nav className="inline-form" aria-label="Vyhľadať priamo u predajcu">
          {providerSearchLinks(q).map((provider) => (
            <a
              key={provider.name}
              className="button secondary"
              href={provider.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Hľadať na {provider.name}
            </a>
          ))}
        </nav>
      )}
      {q && remote.length === 0 && (
        <p className="notice">
          Zobrazené sú uložené ponuky. Živé zdroje čakajú na nastavenie.
        </p>
      )}
      {remote
        .filter((result) => result.status !== 'live')
        .map((result) => (
          <p className="notice" key={result.provider}>
            {liveProviderName[result.provider]} ·{' '}
            {result.status === 'limited'
              ? 'Ďalší dotaz je dočasne obmedzený limitom zdroja.'
              : result.status === 'blocked'
                ? 'Server odmietol prístup k živým výsledkom (HTTP 403).'
                : 'Živé výsledky sa nepodarilo načítať.'}
          </p>
        ))}
      {matches.length ? (
        <div className="cards">
          {matches
            .slice((current - 1) * pageSize, current * pageSize)
            .map((offer) => {
              const data =
                offer.listing &&
                typeof offer.listing === 'object' &&
                !Array.isArray(offer.listing)
                  ? offer.listing
                  : null
              const priceLabel =
                typeof data?.priceLabel === 'string' ? data.priceLabel : null
              const provider =
                offer.merchant.name === liveProviderName.alza
                  ? 'alza'
                  : offer.merchant.name === liveProviderName.bazos
                    ? 'bazos'
                    : null
              const photo =
                provider && imagesAllowed(provider)
                  ? listingPhoto(data?.image, provider)
                  : null
              return (
                <article className="card" key={offer.id}>
                  {photo && (
                    <div className="art">
                      <Image
                        src={photo}
                        alt=""
                        width={240}
                        height={180}
                        unoptimized
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div className="card-body">
                    <small>
                      {offer.merchant.name} ·{' '}
                      {offer.live ? 'Živý zdroj' : 'Uložená ponuka'}
                    </small>
                    <h3>
                      <a
                        href={offer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {offer.title}
                      </a>
                    </h3>
                    <strong>{euro(offer.price)}</strong>
                    {priceLabel && <p>{priceLabel}</p>}
                  </div>
                </article>
              )
            })}
        </div>
      ) : (
        <p className="empty">Pre tento dotaz nemáme ponuky.</p>
      )}
      {pages > 1 && (
        <nav className="pager" aria-label="Stránkovanie">
          {current > 1 && (
            <Link href={pageUrl(current - 1)}>Predchádzajúca</Link>
          )}
          <span>
            {current} / {pages}
          </span>
          {current < pages && <Link href={pageUrl(current + 1)}>Ďalšia</Link>}
        </nav>
      )}
    </section>
  )
}
