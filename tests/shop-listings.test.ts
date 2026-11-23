import { describe, expect, it } from 'vitest'
import { extractShopListings, isEmptyShopSearch } from '../lib/shop-listings'
import { shopPhoto, shopSources } from '../lib/shop-sources'

const shop = (id: string) => shopSources.find((shop) => shop.id === id)!

describe('retailer HTML scrapers', () => {
  it('reads nested NAY product lists with exact EUR prices and merchant photos', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'ItemList', itemListElement: [{ '@type': 'ListItem', item: {
        '@type': 'Product', name: 'Sony PS5 Slim', sku: 'sony-slim',
        url: 'https://www.nay.sk/sony-slim', image: 'https://image.nay.sk/sony.jpg',
        offers: { '@type': 'Offer', price: 579.99, priceCurrency: 'EUR' },
      } }],
    })}</script>`
    expect(extractShopListings(html, shop('nay'))).toEqual([{
      id: 'sony-slim', name: 'Sony PS5 Slim', priceCents: 57999,
      url: 'https://www.nay.sk/sony-slim', image: 'https://image.nay.sk/sony.jpg',
    }])
    expect(extractShopListings(html.replace('EUR', 'USD'), shop('nay'))).toEqual([])
    expect(extractShopListings(html.replace('www.nay.sk/sony-slim', 'www.nay.sk.example.com/sony-slim'), shop('nay'))).toEqual([])
    expect(extractShopListings(html.replace('https://www.nay.sk/sony-slim', ''), shop('nay'))).toEqual([])
  })

  it('uses PLANEO gross price rather than the VAT-exclusive analytics value', () => {
    const html = '<div class="c-product--catalogue" data-gtm-product-price="600.81"><div class="c-product__title"><a href="/sony">Sony PS5</a></div><div class="c-product__price"><strong data-test-value="739.00">739,00 €</strong></div><div class="c-product__image"><img src="https://mc-static.fast.eu/sony.webp"></div></div>'
    expect(extractShopListings(html, shop('planeo'))[0]).toMatchObject({ priceCents: 73900, image: 'https://mc-static.fast.eu/sony.webp' })
  })

  it('ignores TPD club discounts and takes the lazy product image', () => {
    const html = '<div class="products__item"><a class="products__name" href="/sony-p123">Sony PS5</a><div class="products__price--actual"><span class="number">499,99 €</span></div><div class="products__price--member"><span class="number">-20,00 €</span></div><div class="products__img"><img src="/spinner.gif" data-src="//images.tpd.sk/sony.jpg"></div></div>'
    expect(extractShopListings(html, shop('tpd'))[0]).toMatchObject({ priceCents: 49999, image: 'https://images.tpd.sk/sony.jpg' })
  })

  it('parses Shoptet currency prefixes, thousands and regular rather than discounted references', () => {
    const html = '<div class="product"><a class="name" href="/sony">Sony PS5</a><div class="price-additional">€1.055,00 bez DPH</div><div class="price-final"><strong>€1.299,99</strong></div><a class="image"><img src="https://cdn.myshoptet.com/sony.jpg"></a></div>'
    expect(extractShopListings(html, shop('compy'))[0]).toMatchObject({ priceCents: 129999 })
  })

  it('uses the FastCentrik gross price and preserves safe relative listing links', () => {
    const html = '<div class="boxcont products"><div class="prodbox"><a class="stiplname" href="sony_d123.html">Sony PS5</a><div class="price"><div class="wvat"><span>615.00 €</span></div><div class="wovat"><span>500.00 €</span></div></div><img src="https://img.datacomp.sk/sony.jpg"></div></div>'
    expect(extractShopListings(html, shop('datacomp'))[0]).toMatchObject({ priceCents: 61500, url: 'https://datacomp.sk/sony_d123.html' })
  })

  it('recognizes genuine empty search pages and rejects foreign photos', () => {
    expect(isEmptyShopSearch('<main>Produkty neboli nájdené</main>')).toBe(true)
    expect(isEmptyShopSearch('<h1>Server error</h1>')).toBe(false)
    expect(shopPhoto('https://image.nay.sk.example.com/photo.jpg', shop('nay'))).toBeNull()
    expect(shopPhoto('http://image.nay.sk/photo.jpg', shop('nay'))).toBeNull()
  })

  it('adds a card photo to JSON-LD without replacing its price with an ambiguous card price', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Product', name: 'Sony PS5', url: 'https://www.planeo.sk/sony',
      offers: { '@type': 'Offer', price: 599, priceCurrency: 'EUR' },
    })}</script><div class="c-product--catalogue"><div class="c-product__title"><a href="/sony">Sony PS5</a></div><div class="c-product__image"><img src="https://mc-static.fast.eu/sony.jpg"></div></div>`
    expect(extractShopListings(html, shop('planeo'))).toHaveLength(1)
    expect(extractShopListings(html, shop('planeo'))[0]).toMatchObject({ priceCents: 59900, image: 'https://mc-static.fast.eu/sony.jpg' })
  })
})
