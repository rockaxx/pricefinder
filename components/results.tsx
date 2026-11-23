import Link from 'next/link'
import { SlidersHorizontal, SearchX } from 'lucide-react'
import { db } from '../lib/db'
import { categories, publicCatalog, search } from '../lib/catalog'
import { stockLabels } from '../lib/domain'
import { Cards } from './catalog'
import { SearchBox } from './search-box'
export type Query = Record<string, string | string[] | undefined>
export const clean = (query: Query): Record<string, string> =>
  Object.fromEntries(
    [
      'q',
      'category',
      'brand',
      'condition',
      'shop',
      'stock',
      'origin',
      'min',
      'max',
      'sort',
      'page',
    ].flatMap((key) => {
      const value = query[key]
      return typeof value === 'string' ? [[key, value.slice(0, 100)]] : []
    }),
  )
export async function Results({
  query,
  category,
}: {
  query: Query
  category?: string
}) {
  const filters: Record<string, string> = {
    ...clean(query),
    ...(category && { category }),
  }
  const [rows, brands, shops, demos] = await Promise.all([
    search(filters),
    db.product.findMany({
      where: publicCatalog,
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
    }),
    db.merchant.findMany({
      where: { offers: { some: { source: { enabled: true } } } },
      orderBy: { name: 'asc' },
    }),
    db.dataSource.count({ where: { demo: true, enabled: true } }),
  ])
  const base = category ? '/kategoria/' + category : '/vyhladavanie'
  const pages = Math.max(1, Math.ceil(rows.length / 8))
  const page = Math.max(1, Math.min(pages, Number.parseInt(filters.page) || 1))
  const link = (next: number) =>
    base + '?' + new URLSearchParams({ ...filters, page: String(next) })
  const select = (
    name: string,
    label: string,
    options: readonly (readonly [string, string])[],
  ) => (
    <label>
      {label}
      <select aria-label={label} name={name} defaultValue={filters[name] || ''}>
        <option value="">Všetky</option>
        {options.map(([v, t]) => (
          <option value={v} key={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  )
  return (
    <div className="section">
      <h1>
        {category
          ? categories.find(([id]) => id === category)?.[1]
          : filters.q
            ? 'Výsledky pre „' + filters.q + '“'
            : 'Katalóg produktov'}
      </h1>
      <SearchBox initial={filters.q} />
      <div className="results">
        <aside className="panel">
          <form className="filters" action={base}>
            <h2>
              <SlidersHorizontal size={18} /> Filtre
            </h2>
            <input type="hidden" name="q" value={filters.q || ''} />
            {!category && select('category', 'Kategória', categories)}
            {select(
              'brand',
              'Značka',
              brands.map((x) => [x.brand, x.brand]),
            )}
            {select('condition', 'Stav', [
              ['new', 'Nové'],
              ['used', 'Použité'],
            ])}
            {select(
              'shop',
              'Obchod',
              shops.map((x) => [x.id, x.name]),
            )}
            {select('stock', 'Dostupnosť', Object.entries(stockLabels))}
            {demos > 0 &&
              select('origin', 'Zdroj ponúk', [
                ['real', 'Ponuky obchodov'],
                ['demo', 'Ukážkové ponuky'],
              ])}
            <div className="form-grid">
              <label>
                Od (€)
                <input
                  name="min"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={filters.min}
                />
              </label>
              <label>
                Do (€)
                <input
                  name="max"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={filters.max}
                />
              </label>
            </div>
            <label>
              Zoradiť
              <select name="sort" defaultValue={filters.sort || ''}>
                <option value="">Relevantnosť</option>
                <option value="price">Celková cena</option>
                <option value="offers">Počet ponúk</option>
              </select>
            </label>
            <button className="button">Použiť filtre</button>
            <Link
              href={
                base + (filters.q ? '?q=' + encodeURIComponent(filters.q) : '')
              }
            >
              Vymazať filtre
            </Link>
          </form>
        </aside>
        <section>
          <p className="muted">
            {rows.length} výsledkov · Cenový filter používa cenu produktu, ak
            chýba cena dopravy.
          </p>
          {rows.length ? (
            <Cards rows={rows.slice((page - 1) * 8, page * 8)} />
          ) : (
            <div className="empty">
              <SearchX />
              <h2>Nenašli sa žiadne produkty</h2>
              <p>Skús upraviť vyhľadávanie alebo filtre.</p>
            </div>
          )}
          {pages > 1 && (
            <nav className="pager" aria-label="Stránkovanie">
              {page > 1 && <Link href={link(page - 1)}>Predchádzajúca</Link>}
              <span>
                {page} / {pages}
              </span>
              {page < pages && <Link href={link(page + 1)}>Ďalšia</Link>}
            </nav>
          )}
        </section>
      </div>
    </div>
  )
}
