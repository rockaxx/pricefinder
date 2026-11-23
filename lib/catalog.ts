import { db } from './db'
import { available, byTotal, cents, relevance, total } from './domain'
export const categories = [
  ['konzoly', 'Herné konzoly'],
  ['mobily', 'Mobilné telefóny'],
  ['notebooky', 'Notebooky'],
  ['grafika', 'Grafické karty'],
  ['pocitace', 'Počítače'],
  ['televizory', 'Televízory'],
  ['sluchadla', 'Slúchadlá'],
] as const
const include = { merchant: true, source: true } as const
export const publicCatalog = {
  OR: [{ demo: false }, { offers: { some: { source: { enabled: true } } } }],
}
export async function product(id: string) {
  return db.product.findFirst({
    where: { id, ...publicCatalog },
    include: {
      category: true,
      offers: {
        where: { source: { enabled: true } },
        include: { ...include, history: { orderBy: { observed: 'asc' } } },
      },
    },
  })
}
export async function search(filters: Record<string, string> = {}) {
  const {
    q = '',
    category,
    brand,
    condition,
    shop,
    stock,
    origin,
    min = '',
    max = '',
    sort,
  } = filters
  const low = cents(min),
    high = cents(max)
  const products = await db.product.findMany({
    where: {
      ...publicCatalog,
      ...(category && { categoryId: category }),
      ...(brand && { brand }),
      ...((origin === 'real' || origin === 'demo') && {
        demo: origin === 'demo',
      }),
    },
    include: {
      category: true,
      offers: { where: { source: { enabled: true } }, include },
    },
    orderBy: { id: 'asc' },
  })
  const rows = products.flatMap((p) => {
    const score = relevance(q, p.name)
    if (!score) return []
    const offers = p.offers
      .filter((o) => {
        const comparison = total(o) ?? o.price
        return (
          (stock ? stock === o.availability : available(o.availability)) &&
          (!condition || condition === o.condition) &&
          (!shop || shop === o.merchantId) &&
          (low === null || comparison >= low) &&
          (high === null || comparison <= high)
        )
      })
      .sort(byTotal)
    if (
      !offers.length &&
      (condition || shop || stock || low !== null || high !== null)
    )
      return []
    return [{ ...p, score, offers }]
  })
  const lowest = (row: (typeof rows)[number]) =>
    row.offers[0] ? (total(row.offers[0]) ?? Infinity) : Infinity
  if (sort === 'price')
    rows.sort((a, b) => lowest(a) - lowest(b) || a.id.localeCompare(b.id))
  else if (sort === 'offers')
    rows.sort((a, b) => b.offers.length - a.offers.length || b.score - a.score)
  else
    rows.sort(
      (a, b) =>
        b.score - a.score ||
        Number(a.demo) - Number(b.demo) ||
        b.offers.length - a.offers.length,
    )
  return rows
}
export type CatalogRow = Awaited<ReturnType<typeof search>>[number]
