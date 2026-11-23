import { db } from '../../../lib/db'
import { safeUrl } from '../../../lib/importer'
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const offer = await db.offer.findUnique({
    where: { id },
    include: { source: true, merchant: true },
  })
  if (!offer?.source.enabled || offer.availability === 'out')
    return new Response('Ponuka nie je dostupná.', { status: 404 })
  const destination = safeUrl(offer.url, offer.merchant.host)
  if (!destination)
    return new Response('Odkaz nie je dostupný.', { status: 404 })
  const template = offer.merchant.affiliate
  const approved = template?.includes('{url}')
    ? safeUrl(template.replaceAll('{url}', encodeURIComponent(destination)))
    : null
  await db.outboundClick
    .create({ data: { offerId: id } })
    .catch(() => console.error('Click recording failed'))
  return new Response(null, {
    status: 302,
    headers: {
      Location: !offer.source.demo && approved ? approved : destination,
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
    },
  })
}
