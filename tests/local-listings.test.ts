import { describe, expect, it } from 'vitest'
import {
  extractBazosListings,
  providerSearchLinks,
} from '../lib/local-listings'

describe('local Bazoš and Alza search', () => {
  it('extracts listing title and price and ignores other prices and seller details', () => {
    const html =
      '<div class="inzeraty inzeratyflex"><div class="inzeratynadpis"><h2 class="nadpis"><a href="https://pc.bazos.sk/inzerat/197612381/example.php">PlayStation 5 Slim</a></h2><div class="popis">Ovládač 50 €</div></div><div class="inzeratycena">660 €</div><a href="https://www.bazos.sk/hodnotenie.php?jmeno=Test">Predajca</a></div>'
    expect(extractBazosListings(html)).toEqual([
      {
        id: '197612381',
        name: 'PlayStation 5 Slim',
        priceCents: 66000,
        url: 'https://pc.bazos.sk/inzerat/197612381/example.php',
        image: null,
        description: 'Ovládač 50 €',
      },
    ])
    expect(extractBazosListings(html.replace('660 €', 'Dohodou'))).toEqual([])
    expect(
      extractBazosListings(
        html.replace('pc.bazos.sk', 'pc.bazos.sk.example.com'),
      ),
    ).toEqual([])
  })
  it('extracts the Bazoš description preview even when the title is neutral', () => {
    const card = (id: number, title: string, description: string) =>
      `<div class="inzeraty inzeratyflex"><div class="inzeratynadpis"><h2 class="nadpis"><a href="https://pc.bazos.sk/inzerat/${id}/sony-ps5.php">${title}</a></h2><div class="popis">${description}</div></div><div class="inzeratycena">300 €</div></div>`
    const description = 'Kupim konzolu Sony PlayStation 5 s ovládačom DualSense.'
    const [listing] = extractBazosListings(card(197822843, 'Sony PlayStation 5', description))
    expect(listing).toMatchObject({ id: '197822843', description })
  })
  it('keeps arbitrary text in the search parameter', () => {
    const [bazos] = providerSearchLinks('iPhone & MacBook')
    expect(providerSearchLinks('test')).toHaveLength(1)
    expect(bazos.name).toBe('Bazoš.sk')
    expect(new URL(bazos.url).searchParams.get('hledat')).toBe(
      'iPhone & MacBook',
    )
  })
})
