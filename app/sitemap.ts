import type { MetadataRoute } from 'next'
import { db } from '../lib/db'
import { categories, publicCatalog } from '../lib/catalog'
export const dynamic = 'force-dynamic'
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL || 'http://localhost:3000'
  const products = await db.product.findMany({
    where: publicCatalog,
    select: { id: true },
  })
  return [
    '/',
    '/ponuky',
    ...categories.map(([id]) => '/kategoria/' + id),
    ...products.map((p) => '/produkt/' + p.id),
  ].map((path) => ({ url: new URL(path, base).href }))
}
