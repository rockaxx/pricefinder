import Link from 'next/link'
import { ArrowUpRight, Bell, ListFilter, Search, Sparkles } from 'lucide-react'
import { search } from '../lib/catalog'
import { Cards, CategoryNav } from '../components/catalog'
import { SearchBox } from '../components/search-box'
import { LocalSearch } from '../components/local-search'
import { localSearchMode } from '../lib/local-search-mode'
export const dynamic = 'force-dynamic'
export const metadata = { alternates: { canonical: '/' } }
export default async function Home() {
  if (localSearchMode()) return <LocalSearch />
  const [rows, deals] = await Promise.all([
    search({ sort: 'offers' }),
    search({ condition: 'used', sort: 'price' }),
  ])
  const curated = [
    'sony-playstation-5-slim-disc-1tb',
    'apple-iphone-16-128gb',
    'apple-macbook-air-m4-13-16gb-ram-256gb-ssd',
    'sony-wh-1000xm5-cierne',
  ]
  const real = rows.filter((row) => !row.demo && row.offers.length > 0)
  const demoFeatured = curated.flatMap((id) =>
    rows.filter((row) => row.id === id),
  )
  const featured = [...real, ...demoFeatured].slice(0, 4)
  const hasDemo = rows.some((row) => row.demo)
  const tips = hasDemo
    ? ['PlayStation 5', 'iPhone 16', 'RTX 5070']
    : [...new Set(featured.map((row) => row.model))]
  return (
    <>
      <link rel="preload" href="/hero.webp" as="image" />
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">
            <Sparkles size={15} /> Porovnávač cien pre Slovensko
          </span>
          <h1>
            Nájdi najlepšiu cenu
            <br />
            za pár sekúnd.
          </h1>
          <p>
            Porovnaj nové aj použité produkty, zisti cenu s dopravou a vyber si
            ponuku, ktorá ti vyhovuje.
          </p>
          <SearchBox />
          {tips.length > 0 && (
            <div className="trending">
              <span>Tipy na hľadanie</span>
              {tips.map((q) => (
                <Link key={q} href={'/vyhladavanie?q=' + encodeURIComponent(q)}>
                  {q}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      {hasDemo && (
        <p className="notice">
          <b>DEMO</b> Ceny, ponuky a dostupnosť v ukážkovom katalógu sú
          ilustračné.
        </p>
      )}
      <section className="section">
        <div className="section-head">
          <h2>Kategórie</h2>
          <Link href="/vyhladavanie">
            Všetky produkty <ArrowUpRight size={16} />
          </Link>
        </div>
        <CategoryNav />
      </section>
      <section className="section">
        <div className="section-head">
          <div>
            <h2>Obľúbené produkty</h2>
            <p>
              {real.length
                ? 'Výber z produktov a ponúk obchodov.'
                : 'Výber z ukážkového katalógu.'}
            </p>
          </div>
          <Link href="/vyhladavanie">
            Zobraziť katalóg <ArrowUpRight size={16} />
          </Link>
        </div>
        <Cards rows={featured} />
      </section>
      {deals.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div>
              <h2>Použité produkty za menej</h2>
              <p>Ponuky zoradené podľa celkovej ceny.</p>
            </div>
            <Link href="/ponuky">
              Prejsť na ponuky <ArrowUpRight size={16} />
            </Link>
          </div>
          <Cards rows={deals.slice(0, 4)} />
        </section>
      )}
      <section className="section">
        <h2>Ako to funguje</h2>
        <div className="steps">
          <article>
            <Search />
            <h3>Vyhľadaj produkt</h3>
            <p>Zadaj značku, model alebo názov.</p>
          </article>
          <article>
            <ListFilter />
            <h3>Porovnaj ponuky</h3>
            <p>Skontroluj stav, dostupnosť a celkovú cenu.</p>
          </article>
          <article>
            <Bell />
            <h3>Nastav cenové upozornenie</h3>
            <p>Vyhľadávanie aj cenové upozornenia sú bezplatné.</p>
          </article>
        </div>
      </section>
    </>
  )
}
