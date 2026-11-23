import { streamSearch, type SearchEvent } from '../../../lib/search-results'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const query = (params.get('q') ?? '').slice(0, 100)
  const page = Number.parseInt(params.get('page') ?? '', 10) || 1
  const filters = Object.fromEntries(['min', 'max', 'sort', 'shop', 'typ'].flatMap((name) => {
    const value = params.get(name)?.slice(0, 100)
    return value ? [[name, value]] : []
  }))
  const encoder = new TextEncoder()
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const publish = (event: SearchEvent) => {
        if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      }
      void streamSearch({ query, page, filters }, publish)
        .catch(() => publish({ type: 'error' }))
        .finally(() => { if (!cancelled) controller.close() })
    },
    cancel() { cancelled = true },
  })
  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
