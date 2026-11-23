import Link from 'next/link'
import Image from 'next/image'
import { ImageOff, SearchX, SlidersHorizontal } from 'lucide-react'
import { euro } from '../lib/domain'
import type { SearchCard, SearchView } from '../lib/search-results'

export function SearchResultView({ view }: { view: SearchView }) {
  const { q, filters, activeCategory, current, pages, sourceOptions, tabs, sources: remote, cards } = view
  const searchUrl = '/vyhladavanie?' + new URLSearchParams({ q })
  const resultsUrl = (type: string, next?: number) => '/vyhladavanie?' + new URLSearchParams({
    q,
    ...(filters.min && { min: filters.min }),
    ...(filters.max && { max: filters.max }),
    ...(filters.sort && { sort: filters.sort }),
    ...(filters.shop && { shop: filters.shop }),
    typ: type,
    ...(next && { page: String(next) }),
  })

  return (
      <div className="results listing-results">
        <aside className="panel">
          <form className="filters" action="/vyhladavanie">
            <h2><SlidersHorizontal size={18} /> Filtre</h2>
            <input type="hidden" name="q" value={q} />
            <input type="hidden" name="typ" value={activeCategory} />
            <label>
              Obchod
              <select name="shop" aria-label="Obchod" defaultValue={filters.shop || ''}>
                <option value="">Všetky obchody</option>
                {[...sourceOptions].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
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
              <select name="sort" aria-label="Zoradiť" defaultValue={filters.sort || ''}>
                <option value="">Relevantnosť</option>
                <option value="price">Cena od najnižšej</option>
                <option value="price-desc">Cena od najvyššej</option>
              </select>
            </label>
            <button className="button">Použiť filtre</button>
            <Link href={searchUrl}>Vymazať filtre</Link>
          </form>
        </aside>
        <section aria-label="Výsledky vyhľadávania">
          {tabs.length > 0 && (
            <nav className="product-types" aria-label="Typ produktu">
              {tabs.map(({ id: type, label, count }) => (
                <Link
                  key={type}
                  href={resultsUrl(type)}
                  prefetch={false}
                  aria-current={activeCategory === type ? 'true' : undefined}
                >
                  {label}
                  <span>{count}</span>
                </Link>
              ))}
            </nav>
          )}
          <div className="section-head">
            <p className="muted">{view.count} ponúk · {view.matchingShops} zdrojov · Ceny bez dopravy</p>
          </div>
          {q && remote.length === 0 && (
            <p className="notice">Zobrazené sú uložené ponuky. Živé vyhľadávanie nie je nastavené.</p>
          )}
          {q && remote.length > 0 && (
            <details className="source-status">
              <summary>Zdroje ({view.matchingLiveShops}/{remote.length} so zhodou)</summary>
              <ul>
                {remote.map((result) => {
                  const { link } = result
                  return <li key={result.id}>
                    <strong>{result.name}</strong> · {result.status === 'live' ? result.count + ' zodpovedajúcich ponúk'
                      : result.status === 'empty' ? 'Pre tento dotaz bez ponúk'
                        : result.status === 'limited' ? 'Dočasný limit požiadaviek'
                        : result.status === 'blocked' ? 'Prístup odmietnutý (HTTP 403)'
                          : 'Žiadne rozpoznané ponuky alebo nedostupný zdroj'}
                    {link && <> · <a href={link} target="_blank" rel="noopener noreferrer">Otvoriť vyhľadávanie</a></>}
                  </li>
                })}
              </ul>
            </details>
          )}
          {cards.length ? (
            <div className="cards">
              {cards.map((offer) => (
                <OfferCard key={offer.id} offer={offer} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <SearchX />
              <h2>{!q ? 'Vyhľadaj ponuky obchodov a bazára' : 'Pre tento dotaz alebo filtre nemáme ponuky'}</h2>
              <p>{!q ? 'Zadaj názov produktu do vyhľadávania.' : 'Skús upraviť vyhľadávanie alebo cenový rozsah.'}</p>
            </div>
          )}
          {pages > 1 && (
            <nav className="pager" aria-label="Stránkovanie">
              {current > 1 && <Link href={resultsUrl(activeCategory, current - 1)} prefetch={false}>Predchádzajúca</Link>}
              <span>{current} / {pages}</span>
              {current < pages && <Link href={resultsUrl(activeCategory, current + 1)} prefetch={false}>Ďalšia</Link>}
            </nav>
          )}
        </section>
      </div>
  )
}

export function OfferCard({ offer }: { offer: SearchCard }) {
  const { photo, priceLabel } = offer
  return (
    <article className="card">
      <a className="art" href={offer.url} target="_blank" rel="noopener noreferrer" aria-label={offer.title}>
        {photo ? (
          <Image src={photo} alt={offer.title} width={480} height={320} unoptimized referrerPolicy="no-referrer" />
        ) : <ImageOff size={32} aria-label="Bez fotografie" />}
      </a>
      <div className="card-body">
        <small>{offer.sourceName} · {offer.live ? 'Živý zdroj' : 'Uložená ponuka'}</small>
        <h3><a href={offer.url} target="_blank" rel="noopener noreferrer">{offer.title}</a></h3>
        <strong>{euro(offer.price)}</strong>
        {priceLabel && <p>{priceLabel}</p>}
      </div>
    </article>
  )
}

