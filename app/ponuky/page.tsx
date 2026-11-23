import Link from 'next/link'
import { db } from '../../lib/db'
import { categories } from '../../lib/catalog'
import { byTotal, euro, total } from '../../lib/domain'
import { dealScore } from '../../lib/deals'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Ponuky',
  alternates: { canonical: '/ponuky' },
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const { category, condition } = await searchParams
  const rows = (
    await db.offer.findMany({
      where: {
        availability: 'in',
        source: { enabled: true },
        product: {
          is: {
            ...(categories.some(([id]) => id === category) && {
              categoryId: category,
            }),
          },
        },
        ...((condition === 'new' || condition === 'used') && { condition }),
      },
      include: {
        product: true,
        source: true,
        merchant: true,
        history: { orderBy: { observed: 'asc' } },
      },
    })
  )
    .map((offer) => ({ offer, score: dealScore(offer) }))
    .sort(
      (a, b) =>
        (b.score?.percent ?? -Infinity) - (a.score?.percent ?? -Infinity) ||
        byTotal(a.offer, b.offer),
    )
    .slice(0, 24)
  return (
    <div className="section">
      <h1>Aktuálne ponuky</h1>
      <p className="muted">
        Skóre porovnáva celkovú cenu s mediánom zaznamenaných cien rovnakej
        ponuky za 90 dní. Vyžaduje aspoň päť rôznych dní. Ponuky bez skóre
        radíme podľa známej celkovej ceny.
      </p>
      <form className="inline-form" action="/ponuky">
        <label>
          Kategória
          <select name="category" defaultValue={category || ''}>
            <option value="">Všetky</option>
            {categories.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stav
          <select name="condition" defaultValue={condition || ''}>
            <option value="">Všetky</option>
            <option value="new">Nové</option>
            <option value="used">Použité</option>
          </select>
        </label>
        <button className="button">Použiť filtre</button>
      </form>
      <div className="offer-list">
        {rows.map(({ offer: o, score }) => (
          <article key={o.id} className="panel deal">
            <div>
              <p className="muted">
                {o.merchant.name} ·{' '}
                {o.condition === 'used' ? 'Použité' : 'Nové'}
                {o.source.demo ? ' · DEMO' : ''}
                {o.sponsored ? ' · Sponzorované' : ''}
              </p>
              <h3>
                <Link href={'/produkt/' + o.productId}>{o.product?.name}</Link>
              </h3>
              <p>
                {score
                  ? (score.percent === 0
                      ? 'Na úrovni mediánu'
                      : Math.abs(score.percent) +
                        ' % ' +
                        (score.percent > 0 ? 'pod' : 'nad') +
                        ' mediánom') +
                    ' ' +
                    euro(score.median) +
                    ' z ' +
                    score.samples +
                    ' dní.'
                  : 'Nedostatok údajov na hodnotenie.'}
              </p>
            </div>
            <div>
              <strong>{euro(total(o) ?? o.price)}</strong>
              <p>
                {o.shipping === null ? 'Doprava neznáma' : 'Vrátane dopravy'}
              </p>
            </div>
          </article>
        ))}
      </div>
      {!rows.length && (
        <p className="empty">Pre tento výber momentálne nemáme ponuky.</p>
      )}
    </div>
  )
}
