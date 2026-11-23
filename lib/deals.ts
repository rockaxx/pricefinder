import { total } from './domain'
type Offer = {
  price: number
  shipping: number | null
  source: { demo: boolean }
  history: { price: number; shipping: number | null; observed: Date }[]
}
export function dealScore(offer: Offer) {
  if (offer.source.demo) return null
  const current = total(offer)
  const days = new Map<string, number>()
  for (const item of offer.history) {
    const amount = total(item)
    if (
      amount !== null &&
      item.observed.getTime() < Date.now() - 86400000 &&
      item.observed.getTime() >= Date.now() - 90 * 86400000
    )
      days.set(item.observed.toISOString().slice(0, 10), amount)
  }
  if (current === null || days.size < 5) return null
  const sorted = [...days.values()].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const median =
    (sorted[middle] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2
  return {
    median,
    percent: Math.round(((median - current) / median) * 100),
    samples: days.size,
  }
}
