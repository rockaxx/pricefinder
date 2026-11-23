import { Results, type Query } from '../../components/results'
import { LocalSearch } from '../../components/local-search'
import { localSearchMode } from '../../lib/local-search-mode'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Vyhľadávanie',
  robots: { index: false, follow: true },
  alternates: { canonical: '/vyhladavanie' },
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Query>
}) {
  const params = await searchParams
  if (localSearchMode())
    return (
      <LocalSearch
        query={typeof params.q === 'string' ? params.q : ''}
        page={Number.parseInt(String(params.page ?? ''), 10)}
      />
    )
  return <Results query={params} />
}
