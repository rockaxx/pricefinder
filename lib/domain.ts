export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bps\s*5\b/g, 'playstation 5')
    .replace(/(\d)\s*(gb|tb)\b/g, '$1$2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
export const euro = (n: number) =>
  new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(
    n / 100,
  )
export const total = (o: { price: number; shipping: number | null }) =>
  o.shipping === null ? null : o.price + o.shipping
export function cents(s: string) {
  const parts = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(s.trim())
  return parts
    ? Number(parts[1]) * 100 + Number((parts[2] ?? '').padEnd(2, '0'))
    : null
}
function near(a: string, b: string) {
  if (a === b) return 4
  if (a.length < 3 || /\d/.test(a)) return 0
  if (b.startsWith(a)) return 3
  if (a.length < 5 || Math.abs(a.length - b.length) > 1) return 0
  const i = [...a].findIndex((c, i) => c !== b[i])
  if (i < 0) return 1
  return a.slice(i + 1) === b.slice(i + 1) ||
    a.slice(i) === b.slice(i + 1) ||
    a.slice(i + 1) === b.slice(i) ||
    (a[i] === b[i + 1] &&
      a[i + 1] === b[i] &&
      a.slice(i + 2) === b.slice(i + 2))
    ? 1
    : 0
}
export function relevance(query: string, title: string) {
  const q = normalize(query)
  if (!q) return 1
  const t = normalize(title)
  const scores = q
    .split(' ')
    .map((a) => Math.max(...t.split(' ').map((b) => near(a, b))))
  return scores.every(Boolean)
    ? scores.reduce((a, b) => a + b, 0) + (t.includes(q) ? 5 : 0)
    : 0
}
type Identity = {
  name: string
  brand: string
  gtin?: string | null
  model?: string
  variant?: string
  storage?: string | null
}
export function match(row: Identity, products: (Identity & { id: string })[]) {
  const compatible = (p: Identity) =>
    (!row.brand || normalize(p.brand) === normalize(row.brand)) &&
    (!row.gtin || !p.gtin || row.gtin === p.gtin) &&
    (['model', 'variant', 'storage'] as const).every(
      (k) => !row[k] || !p[k] || normalize(row[k]) === normalize(p[k]),
    )
  const exact = products.filter(
    (p) => compatible(p) && normalize(p.name) === normalize(row.name),
  )
  if (exact.length === 1)
    return {
      id: exact[0].id,
      confidence: row.gtin && row.gtin === exact[0].gtin ? 100 : 95,
    }
  const gtin = products.filter(
    (p) => row.gtin && row.gtin === p.gtin && compatible(p),
  )
  if (
    gtin.length === 1 &&
    row.brand &&
    row.model &&
    row.variant &&
    gtin[0].model &&
    gtin[0].variant &&
    normalize(row.name) ===
      normalize([row.brand, row.model, row.variant].join(' '))
  )
    return { id: gtin[0].id, confidence: 100 }
  return {
    id: null,
    confidence: gtin.length
      ? 80
      : products.some((p) => relevance(row.name, p.name))
        ? 50
        : 0,
  }
}
export const byTotal = (
  a: { price: number; shipping: number | null },
  b: { price: number; shipping: number | null },
) => (total(a) ?? Infinity) - (total(b) ?? Infinity) || a.price - b.price
export const available = (status: string) => status !== 'out'
export const stockLabels: Record<string, string> = {
  in: 'Na sklade',
  order: 'Na objednávku',
  out: 'Vypredané',
  unknown: 'Overte v obchode',
}
