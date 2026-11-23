import { describe, expect, it } from 'vitest'
import { extractAlzaListings } from '../lib/alza-listings'

const card = (
  code: string,
  price: string,
  stock = '',
  header = '',
  href = '/gaming/example-d123.htm',
) => `
<div class="box browsingitem js-box" data-code="${code}" data-id="123">
  <a class="name browsinglink js-box-link" href="${href}">PlayStation 5 (Slim) – 1TB (s mechanikou)</a>
  <div class="price"><span class="ads-pb">
    <span data-slot="pb-title">${header}</span>
    <span class="js-price-box__primary-price__value">${price}</span>
  </span></div>
  <div class="avl"><span class="avlVal">${stock}</span></div>
</div>`
describe('Alza listing cards', () => {
  it('reads euro cents and keeps variant availability as written', () => {
    const rows = extractAlzaListings(
      card('TEST', '1 219,90&nbsp;€', 'Skladom podľa variantu'),
    )
    expect(rows).toEqual([
      {
        code: 'TEST',
        productId: '123',
        name: 'PlayStation 5 (Slim) – 1TB (s mechanikou)',
        url: 'https://www.alza.sk/gaming/example-d123.htm',
        priceCents: 121990,
        currency: 'EUR',
        priceLabel: null,
        availability: 'Skladom podľa variantu',
      },
    ])
  })
  it('preserves coupon conditions and ignores duplicates, missing prices and foreign links', () => {
    const normal = card('TEST', '679,90 €', '', 'S kódom')
    const rows = extractAlzaListings(
      normal +
        normal +
        card('NOPRICE', 'Na objednávku') +
        card('FOREIGN', '849 €', '', '', 'https://example.com/product'),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      priceCents: 67990,
      priceLabel: 'S kódom',
      availability: null,
    })
  })
})
