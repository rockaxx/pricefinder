import { notFound } from 'next/navigation'
const pages = {
  sukromie: [
    'Ochrana súkromia',
    'Na vytvorenie cenového upozornenia ukladáme e-mail, produkt a cieľovú cenu. Pri prechode do obchodu zaznamenávame identifikátor ponuky a čas kliknutia. Nastavenie vzhľadu sa ukladá v prehliadači. V produkčnej verzii treba doplniť prevádzkovateľa, dobu uchovávania a spôsob uplatnenia práv.',
  ],
  podmienky: [
    'Podmienky používania',
    'PriceFinder porovnáva ponuky a odkazuje na obchody. Objednávky a prípadné reklamácie rieši príslušný predajca. Ceny z ukážkového katalógu slúžia na testovanie. PriceFinder funguje nezávisle od Heureky a uvedených značiek.',
  ],
  kontakt: [
    'Kontakt',
    'Kontaktné údaje prevádzkovateľa budú doplnené pred spustením služby.',
  ],
} as const
type Props = { params: Promise<{ id: string }> }
export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return {
    title: Object.hasOwn(pages, id)
      ? pages[id as keyof typeof pages][0]
      : undefined,
    robots: { index: false, follow: true },
    alternates: { canonical: '/info/' + id },
  }
}
export default async function Page({ params }: Props) {
  const { id } = await params
  if (!Object.hasOwn(pages, id)) notFound()
  const page = pages[id as keyof typeof pages]
  return (
    <div className="section narrow">
      <h1>{page[0]}</h1>
      <p className="notice">Návrh pre demo verziu</p>
      <p>{page[1]}</p>
    </div>
  )
}
