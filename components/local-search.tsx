import Link from 'next/link'
import Image from 'next/image'
import { ImageOff, SearchX, SlidersHorizontal } from 'lucide-react'
import { db } from '../lib/db'
import { cents, euro, relevance } from '../lib/domain'
import { listingPhoto, providerSearchLinks } from '../lib/local-listings'
import { imagesAllowed, liveProviderName, liveSearch } from '../lib/live-search'
import { SearchBox } from './search-box'

const pageSize = 24

export async function LocalSearch({
  query = '',
  page = 1,
  filters = {},
}: {
  query?: string
  page?: number
  filters?: Record<string, string>
}) {
  const q = query.trim().slice(0, 100)
  const [offers, results] = await Promise.all([
    db.offer.findMany({
      where: {
        source: { enabled: true, demo: false },
        availability: { not: 'out' },
        merchant: { name: liveProviderName.bazos },
      },
      select: { id: true, title: true, price: true, url: true, listing: true },
    }),
    liveSearch(q),
  ])
  const remote = results.filter((result) => result.provider === 'bazos')
  const live = remote.filter((result) => result.status === 'live')
  const snapshots = live.length ? [] : offers
    .map((offer) => ({ ...offer, score: relevance(q, offer.title), live: false }))
    .filter((offer) => offer.score > 0)
  const currentOffers = live.flatMap(({ rows }) =>
    rows.map((row) => ({
      id: 'bazos:' + row.id,
      title: row.name,
      url: row.url,
      price: row.priceCents,
      listing: { priceLabel: row.priceLabel ?? null, image: row.image },
      score: Math.max(1, relevance(q, row.name)),
      live: true,
    })),
  )
  const minimum = cents(filters.min ?? '')
  const maximum = cents(filters.max ?? '')
  const matches = [...currentOffers, ...snapshots]
    .filter((offer) =>
      (minimum === null || offer.price >= minimum) &&
      (maximum === null || offer.price <= maximum),
    )
    .sort((a, b) =>
      (filters.sort === 'price'
        ? a.price - b.price
        : filters.sort === 'price-desc'
          ? b.price - a.price
          : b.score - a.score || a.price - b.price) || a.id.localeCompare(b.id),
    )
  const pages = Math.max(1, Math.ceil(matches.length / pageSize))
  const current = Math.min(pages, Math.max(1, page || 1))
  const searchUrl = '/vyhladavanie?' + new URLSearchParams({ q })
  const pageUrl = (next: number) => '/vyhladavanie?' + new URLSearchParams({
    q,
    ...(filters.min && { min: filters.min }),
    ...(filters.max && { max: filters.max }),
    ...(filters.sort && { sort: filters.sort }),
    page: String(next),
  })

  return (
    <section className="section">
      <h1>{q ? 'Výsledky pre „' + q + '“' : 'Vyhľadaj ponuky'}</h1>
      <SearchBox initial={q} suggestions={false} />
      <div className="results listing-results">
        <aside className="panel">
          <form className="filters" action="/vyhladavanie">
            <h2><SlidersHorizontal size={18} /> Filtre</h2>
            <input type="hidden" name="q" value={q} />
            <p className="muted">Zdroj: Bazoš.sk</p>
            <div className="form-grid">
              <label>
                Od (€)
                <input name="min" type="number" min="0" step="0.01" defaultValue={filters.min} />
              </label>
              <label>
                Do (€)
                <input name="max" type="number" min="0" step="0.01" defaultValue={filters.max} />
              </label>
            </div>
            <label>
              Zoradiť
              <select name="sort" defaultValue={filters.sort || ''}>
                <option value="">Relevantnosť</option>
                <option value="price">Cena od najnižšej</option>
                <option value="price-desc">Cena od najvyššej</option>
              </select>
            </label>
            <button className="button">Použiť filtre</button>
            <Link href={searchUrl}>Vymazať filtre</Link>
          </form>
        </aside>
        <section aria-label="Výsledky z Bazoša">
          <div className="section-head">
            <p className="muted">{matches.length} ponúk · Bazoš.sk · Cena uvedená v inzeráte</p>
            {q && providerSearchLinks(q).map((provider) => (
              <a key={provider.name} href={provider.url} target="_blank" rel="noopener noreferrer">
                Hľadať na {provider.name}
              </a>
            ))}
          </div>
          {q && remote.length === 0 && (
            <p className="notice">Zobrazené sú uložené ponuky. Živé vyhľadávanie na Bazoši nie je nastavené.</p>
          )}
          {remote.filter((result) => result.status !== 'live').map((result) => (
            <p className="notice" key={result.provider}>
              Bazoš.sk · {result.status === 'limited'
                ? 'Ďalší dotaz je dočasne obmedzený limitom zdroja.'
                : result.status === 'blocked'
                  ? 'Server odmietol prístup k živým výsledkom (HTTP 403).'
                  : 'Živé výsledky sa nepodarilo načítať.'}
            </p>
          ))}
          {matches.length ? (
            <div className="cards">
              {matches.slice((current - 1) * pageSize, current * pageSize).map((offer) => {
                const data = offer.listing && typeof offer.listing === 'object' && !Array.isArray(offer.listing)
                  ? offer.listing : null
                const priceLabel = typeof data?.priceLabel === 'string' ? data.priceLabel : null
                const photo = imagesAllowed('bazos') ? listingPhoto(data?.image, 'bazos') : null
                return (
                  <article className="card" key={offer.id}>
                    <a className="art" href={offer.url} target="_blank" rel="noopener noreferrer" aria-label={offer.title}>
                      {photo ? (
                        <Image src={photo} alt={offer.title} width={480} height={320} unoptimized referrerPolicy="no-referrer" />
                      ) : <ImageOff size={32} aria-label="Bez fotografie" />}
                    </a>
                    <div className="card-body">
                      <small>Bazoš.sk · {offer.live ? 'Živý zdroj' : 'Uložená ponuka'}</small>
                      <h3><a href={offer.url} target="_blank" rel="noopener noreferrer">{offer.title}</a></h3>
                      <strong>{euro(offer.price)}</strong>
                      {priceLabel && <p>{priceLabel}</p>}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty">
              <SearchX />
              <h2>{!q ? 'Vyhľadaj ponuky na Bazoši' : 'Pre tento dotaz alebo filtre nemáme ponuky'}</h2>
              <p>{!q ? 'Zadaj názov produktu do vyhľadávania.' : 'Skús upraviť vyhľadávanie alebo cenový rozsah.'}</p>
            </div>
          )}
          {pages > 1 && (
            <nav className="pager" aria-label="Stránkovanie">
              {current > 1 && <Link href={pageUrl(current - 1)}>Predchádzajúca</Link>}
              <span>{current} / {pages}</span>
              {current < pages && <Link href={pageUrl(current + 1)}>Ďalšia</Link>}
            </nav>
          )}
        </section>
      </div>
    </section>
  )
}
