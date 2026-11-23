import type { Metadata } from 'next'
import Link from 'next/link'
import { ScanSearch, Search, Tag } from 'lucide-react'
import { Theme, Toggle } from '../components/theme'
import { localSearchMode } from '../lib/local-search-mode'
import './globals.css'
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'PriceFinder.sk | Porovnanie cien',
    template: '%s | PriceFinder.sk',
  },
  description:
    'Porovnajte ceny, dopravu a dostupnosť nových aj použitých produktov.',
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" suppressHydrationWarning>
      <body>
        <Theme>
          <header>
            <div className="wrap top">
              <Link href="/" className="logo">
                <span>
                  <ScanSearch size={21} />
                </span>
                PriceFinder<b>.sk</b>
              </Link>
              <nav aria-label="Hlavná navigácia">
                <Link href="/vyhladavanie">
                  <Search size={16} /> Produkty
                </Link>
                {!localSearchMode() && (
                  <Link href="/ponuky">
                    <Tag size={16} /> Ponuky
                  </Link>
                )}
              </nav>
              <Toggle />
            </div>
          </header>
          <main className="wrap">{children}</main>
          <footer>
            <div className="wrap foot">
              <Link className="logo" href="/">
                PriceFinder<b>.sk</b>
              </Link>
              <p>Bezplatné porovnanie cien.</p>
              <nav aria-label="Informácie">
                <Link href="/info/sukromie">Súkromie</Link>
                <Link href="/info/podmienky">Podmienky</Link>
                <Link href="/info/kontakt">Kontakt</Link>
              </nav>
            </div>
          </footer>
        </Theme>
      </body>
    </html>
  )
}
