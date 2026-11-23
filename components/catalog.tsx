import Link from 'next/link'
import Image from 'next/image'
import {
  Gamepad2,
  Smartphone,
  Laptop,
  Cpu,
  Monitor,
  Tv,
  Headphones,
  Package,
} from 'lucide-react'
import { categories, type CatalogRow } from '../lib/catalog'
import { euro, stockLabels, total } from '../lib/domain'
const icons = {
  konzoly: Gamepad2,
  mobily: Smartphone,
  notebooky: Laptop,
  grafika: Cpu,
  pocitace: Monitor,
  televizory: Tv,
  sluchadla: Headphones,
}
export const date = (d: Date) =>
  new Intl.DateTimeFormat('sk-SK', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Bratislava',
  }).format(d)
export function CategoryNav() {
  return (
    <div className="categories">
      {categories.map(([id, name]) => {
        const Icon = icons[id]
        return (
          <Link key={id} href={'/kategoria/' + id}>
            <span>
              <Icon size={24} />
            </span>
            {name}
          </Link>
        )
      })}
    </div>
  )
}
export function ProductArt({
  category,
  images,
  name,
  demo,
  eager = false,
}: {
  category: string
  images: unknown
  name: string
  demo: boolean
  eager?: boolean
}) {
  const Icon = icons[category as keyof typeof icons] || Package
  const illustration = name.includes('PlayStation 5 Pro')
    ? 'pro'
    : name.includes('PlayStation 5 Slim Digital')
      ? 'digital'
      : category
  const supplied =
    Array.isArray(images) && typeof images[0] === 'string' ? images[0] : null
  const src =
    supplied ??
    (demo && Object.hasOwn(icons, category)
      ? '/' + illustration + '.webp'
      : null)
  return (
    <div className={'art art-' + category}>
      {src ? (
        <Image
          src={src}
          alt={supplied ? name : 'Ilustračný obrázok kategórie'}
          width={400}
          height={400}
          loading={eager ? 'eager' : 'lazy'}
          unoptimized
        />
      ) : (
        <Icon size={68} strokeWidth={1.15} />
      )}{' '}
      {demo && <span className="demo">DEMO</span>}
    </div>
  )
}
export function Cards({ rows }: { rows: CatalogRow[] }) {
  return (
    <div className="cards">
      {rows.map((p) => {
        const datedOffers = p.offers.filter((o) => o.source.kind !== 'snapshot')
        const fresh = datedOffers.length
          ? new Date(Math.max(...datedOffers.map((o) => o.updatedAt.getTime())))
          : null
        return (
          <article className="card" key={p.id}>
            <Link href={'/produkt/' + p.id}>
              <ProductArt
                category={p.categoryId}
                images={p.images}
                name={p.name}
                demo={p.demo}
              />
              <div className="card-body">
                <small>
                  {p.brand} · {p.category.name}
                </small>
                <h3>{p.model}</h3>
                <p>{p.variant}</p>
              </div>
            </Link>
            <div className="card-body card-prices">
              {['new', 'used', 'unknown'].map((c) => {
                const o = p.offers.find((o) => o.condition === c)
                return (
                  o && (
                    <div key={c}>
                      <small>
                        {o.source.kind === 'snapshot'
                          ? o.merchant.name + ' · cena zo snímky'
                          : c === 'new'
                            ? 'Nové od'
                            : c === 'used'
                              ? 'Použité od'
                              : 'Cena od'}{' '}
                        {o.source.demo ? '· DEMO' : ''}
                      </small>
                      <strong>{euro(total(o) ?? o.price)}</strong>
                      {o.shipping === null && <small>Bez známej dopravy</small>}
                    </div>
                  )
                )
              })}
            </div>
            <div className="card-body card-meta">
              <small>
                {p.offers.length} ponúk
                {p.offers[0]
                  ? ' · ' + stockLabels[p.offers[0].availability]
                  : ''}
              </small>
              {fresh && <small>Aktualizované {date(fresh)}</small>}
              {p.offers.some((o) => o.source.kind === 'snapshot') && (
                <small>Dátum snímky neznámy</small>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
