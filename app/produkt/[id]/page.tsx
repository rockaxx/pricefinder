import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3, ExternalLink } from 'lucide-react'
import { product, search } from '../../../lib/catalog'
import {
  available,
  byTotal,
  euro,
  stockLabels,
  total,
} from '../../../lib/domain'
import { Cards, date, ProductArt } from '../../../components/catalog'
import { Gallery } from '../../../components/gallery'
import { AlertForm } from '../../../components/alert-form'
import { History } from '../../../components/history'
import type { Query } from '../../../components/results'
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Query> }
export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const p = await product(id)
  return {
    title: p?.name,
    description: p?.name + ' · Porovnanie cien a dostupnosti',
    alternates: { canonical: '/produkt/' + id },
  }
}
export default async function Page({ params, searchParams }: Props) {
  const { id } = await params
  const p = await product(id)
  if (!p) notFound()
  const query = await searchParams
  const filtered = p.offers.filter((o) =>
    query.stav === 'new' || query.stav === 'used'
      ? o.condition === query.stav
      : true,
  )
  const offers = filtered.sort(
    (a, b) =>
      Number(available(b.availability)) - Number(available(a.availability)) ||
      (query.sort === 'price' ? a.price - b.price : byTotal(a, b)),
  )
  const best = p.offers
    .filter((o) => available(o.availability) && total(o) !== null)
    .sort(byTotal)[0]
  const recording = p.offers
    .filter((o) => o.history.length > 0)
    .sort(
      (a, b) =>
        Number(a.source.demo) - Number(b.source.demo) ||
        b.history.length - a.history.length,
    )[0]
  const points =
    recording?.history.map((o) => ({
      id: o.id,
      label: date(o.observed),
      price: o.price,
    })) ?? []
  const images = Array.isArray(p.images)
    ? p.images.filter((x): x is string => typeof x === 'string')
    : []
  const similar = (await search({ category: p.categoryId }))
    .filter((x) => x.id !== id)
    .slice(0, 4)
  const specs =
    p.specs && typeof p.specs === 'object' && !Array.isArray(p.specs)
      ? Object.entries(p.specs)
      : []
  const schema = p.demo
    ? null
    : {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        model: p.model,
        brand: { '@type': 'Brand', name: p.brand },
        ...(images.length && { image: images }),
      }
  return (
    <div className="section">
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema).replaceAll('<', '\\u003c'),
          }}
        />
      )}
      <nav className="breadcrumb" aria-label="Cesta">
        <Link href="/">Domov</Link> /{' '}
        <Link href={'/kategoria/' + p.categoryId}>{p.category.name}</Link>
      </nav>
      <section className="product-head">
        <div>
          {images.length ? (
            <Gallery images={images} name={p.name} />
          ) : (
            <ProductArt
              category={p.categoryId}
              images={[]}
              name={p.name}
              demo={p.demo}
              eager
            />
          )}
        </div>
        <div>
          <p className="muted">
            {p.brand} · {p.demo ? 'DEMO katalóg' : p.category.name}
          </p>
          <h1>{p.name}</h1>
          <p>{p.variant}</p>
          {best && (
            <p className="headline-price">
              Od {euro(total(best)!)}{' '}
              <small>
                vrátane známej dopravy{best.source.demo ? ' · DEMO' : ''}
              </small>
            </p>
          )}
          <dl className="specs">
            {specs.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
          <a className="button" href="#ponuky">
            Porovnať ponuky
          </a>
        </div>
      </section>
      <section className="section" id="ponuky">
        <h2>Ponuky obchodov a bazárov</h2>
        <form className="inline-form" action={'/produkt/' + p.id + '#ponuky'}>
          <label>
            Stav
            <select
              aria-label="Stav"
              name="stav"
              defaultValue={String(query.stav ?? '')}
            >
              <option value="">Všetky</option>
              <option value="new">Nové</option>
              <option value="used">Použité</option>
            </select>
          </label>
          <label>
            Zoradiť
            <select
              aria-label="Zoradiť"
              name="sort"
              defaultValue={String(query.sort ?? '')}
            >
              <option value="total">Celková cena</option>
              <option value="price">Cena produktu</option>
            </select>
          </label>
          <button className="button">Zoradiť ponuky</button>
        </form>
        {offers.length ? (
          <div className="offer-list">
            {offers.map((o) => (
              <article className="panel offer" key={o.id}>
                <div>
                  <h3>{o.merchant.name}</h3>
                  <p>
                    {o.source.kind === 'snapshot' ? (
                      'Skladom podľa variantu v snímke'
                    ) : (
                      <>
                        {o.condition === 'used' ? 'Použité' : 'Nové'} ·{' '}
                        {stockLabels[o.availability]}
                      </>
                    )}
                    {o.source.demo ? ' · DEMO' : ''}
                    {o.sponsored ? ' · Sponzorované' : ''}
                  </p>
                  <small>
                    {o.source.kind === 'snapshot' ? (
                      'Cena zo snímky · dátum a aktuálna dostupnosť neznáme'
                    ) : (
                      <>
                        {o.location ? o.location + ' · ' : ''}Aktualizované{' '}
                        {date(o.updatedAt)}
                      </>
                    )}
                  </small>
                </div>
                <div>
                  <small>
                    {o.source.kind === 'snapshot' ? 'Cena na karte' : 'Produkt'}
                  </small>
                  <b>{euro(o.price)}</b>
                </div>
                <div>
                  <small>Doprava</small>
                  <b>
                    {o.shipping === null
                      ? 'Neznáma'
                      : o.shipping === 0
                        ? 'Zdarma'
                        : euro(o.shipping)}
                  </b>
                </div>
                <div>
                  <small>Spolu</small>
                  <b>{total(o) === null ? 'Neznáme' : euro(total(o)!)}</b>
                </div>
                {o.availability !== 'out' && (
                  <a
                    className="button secondary"
                    href={'/odchod/' + o.id}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                  >
                    {o.source.demo ? 'Demo odkaz' : 'Prejsť do obchodu'}{' '}
                    <ExternalLink size={15} />
                  </a>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">Pre tento výber momentálne nemáme ponuky.</p>
        )}
      </section>
      <div className="detail-grid">
        <section className="panel history">
          <h2>
            <BarChart3 size={22} /> História cien
          </h2>
          {recording && points.length > 0 ? (
            <>
              <p>
                {recording.merchant.name} · cena produktu
                {recording.source.demo ? ' · DEMO pozorovania z importu' : ''}
              </p>
              <History points={points} />
            </>
          ) : (
            <p>Zatiaľ neboli zaznamenané žiadne ceny z importu.</p>
          )}
        </section>
        <AlertForm id={p.id} />
      </div>
      <section className="section">
        <h2>Podobné produkty</h2>
        <Cards rows={similar} />
      </section>
    </div>
  )
}
