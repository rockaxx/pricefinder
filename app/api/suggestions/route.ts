import { search } from '../../../lib/catalog'
const buckets = new Map<string, { expiry: number; count: number }>()
export async function GET(request: Request) {
  const now = Date.now()
  for (const [key, value] of buckets)
    if (value.expiry <= now) buckets.delete(key)
  const ip = request.headers.get('x-real-ip')?.slice(0, 100) || 'local'
  const bucket = buckets.get(ip) ?? { expiry: now + 60000, count: 0 }
  if (bucket.count >= 60 || (!buckets.has(ip) && buckets.size >= 5000))
    return Response.json([], { status: 429, headers: { 'Retry-After': '60' } })
  bucket.count++
  buckets.set(ip, bucket)
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2 || q.length > 100) return Response.json([])
  return Response.json(
    (await search({ q })).slice(0, 6).map(({ id, name }) => ({ id, name })),
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
