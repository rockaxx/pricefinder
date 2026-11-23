import { notFound } from 'next/navigation'
import { categories } from '../../../lib/catalog'
import { Results, type Query } from '../../../components/results'
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Query> }
export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return {
    title: categories.find(([key]) => key === id)?.[1],
    alternates: { canonical: '/kategoria/' + id },
  }
}
export default async function Page({ params, searchParams }: Props) {
  const { id } = await params
  if (!categories.some(([key]) => key === id)) notFound()
  return <Results category={id} query={await searchParams} />
}
