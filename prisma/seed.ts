import 'dotenv/config'
import { db } from '../lib/db'
import { categories } from '../lib/catalog'
import { normalize } from '../lib/domain'
import { partners } from '../lib/partners'

const catalog: [string, string, string, string, number][] = [
  ['konzoly', 'Sony', 'PlayStation 5 Slim', 'Disc 1 TB', 469],
  ['konzoly', 'Sony', 'PlayStation 5 Slim', 'Digital 1 TB', 389],
  ['konzoly', 'Sony', 'PlayStation 5 Pro', 'Digital 2 TB', 689],
  ['konzoly', 'Nintendo', 'Switch OLED', '64 GB', 289],
  ['konzoly', 'Microsoft', 'Xbox Series X', 'Disc 1 TB', 489],
  ['konzoly', 'Microsoft', 'Xbox Series S', 'Digital 512 GB', 249],
  ['mobily', 'Apple', 'iPhone 16', '128 GB', 699],
  ['mobily', 'Apple', 'iPhone 16', '256 GB', 819],
  ['mobily', 'Apple', 'iPhone 15', '128 GB', 569],
  ['mobily', 'Samsung', 'Galaxy S25', '128 GB', 639],
  ['mobily', 'Samsung', 'Galaxy A56', '128 GB', 319],
  ['mobily', 'Google', 'Pixel 9', '128 GB', 529],
  ['notebooky', 'Apple', 'MacBook Air M4 13', '16 GB RAM · 256 GB SSD', 999],
  ['notebooky', 'Lenovo', 'ThinkPad E14 Gen 6', '16 GB RAM · 512 GB SSD', 779],
  ['notebooky', 'ASUS', 'Zenbook 14 OLED', '16 GB RAM · 1 TB SSD', 1099],
  ['notebooky', 'Acer', 'Swift Go 14', '16 GB RAM · 512 GB SSD', 699],
  ['notebooky', 'HP', 'Pavilion 15', '16 GB RAM · 512 GB SSD', 549],
  ['grafika', 'MSI', 'GeForce RTX 5070 Ventus', '12 GB', 569],
  ['grafika', 'Sapphire', 'Radeon RX 9070 Pulse', '16 GB', 609],
  ['grafika', 'Gigabyte', 'GeForce RTX 5060 Ti Windforce', '16 GB', 429],
  ['grafika', 'ASUS', 'Dual Radeon RX 7600', '8 GB', 249],
  ['pocitace', 'Apple', 'Mac mini M4', '16 GB RAM · 256 GB SSD', 649],
  ['pocitace', 'Lenovo', 'IdeaCentre Mini', '16 GB RAM · 512 GB SSD', 579],
  ['pocitace', 'HP', 'Pro Mini 400 G9', '16 GB RAM · 512 GB SSD', 629],
  ['televizory', 'LG', 'OLED C4', '55″', 999],
  ['televizory', 'Samsung', 'S90D', '65″', 1299],
  ['televizory', 'TCL', 'C805', '55″', 579],
  ['sluchadla', 'Sony', 'WH-1000XM5', 'Čierne', 269],
  ['sluchadla', 'Apple', 'AirPods Pro 2', 'USB-C', 209],
  ['sluchadla', 'Bose', 'QuietComfort Ultra', 'Čierne', 329],
]
async function run() {
  for (const [id, name] of categories)
    await db.category.upsert({
      where: { id },
      update: { name },
      create: { id, name },
    })
  for (const [id, name, kind, demo, enabled] of [
    ['demo', 'Ukážkové obchody', 'demo', true, true],
    ['demo-used', 'Ukážkový bazár', 'marketplace', true, true],
    ['sample', 'Testovací import', 'xml', true, true],
  ] as const)
    await db.dataSource.upsert({
      where: { id },
      update: {},
      create: { id, name, kind, demo, enabled },
    })
  for (const [id, { name }] of Object.entries(partners)) {
    const kind = id === 'heureka' ? 'partner' : 'marketplace'
    await db.dataSource.upsert({
      where: { id },
      update: {},
      create: { id, name, kind },
    })
  }
  const merchants = [
    ['tech', 'TechPoint'],
    ['pixel', 'Pixel Market'],
    ['nova', 'Nova Elektro'],
    ['bazar', 'Demo bazár'],
  ]
  for (const [id, name] of merchants)
    await db.merchant.upsert({
      where: { id },
      update: {},
      create: { id, name },
    })
  await db.dataSource.update({
    where: { id: 'sample' },
    data: { merchantId: 'tech' },
  })
  await db.dataSource.update({
    where: { id: 'demo-used' },
    data: { merchantId: 'bazar' },
  })
  for (const [
    index,
    [categoryId, brand, model, variant, price],
  ] of catalog.entries()) {
    const name = brand + ' ' + model + ' ' + variant
    const id = normalize(name).replaceAll(' ', '-')
    await db.product.upsert({
      where: { id },
      update: {},
      create: {
        id,
        categoryId,
        brand,
        model,
        variant,
        name,
        demo: true,
        storage:
          variant.match(/(\d+ (?:GB|TB)) SSD/)?.[1] ??
          (categoryId === 'grafika' ? undefined : variant.match(/\d+ (?:GB|TB)/)?.[0]),
        images: [],
        specs: { Výrobca: brand, Model: model, Variant: variant },
      },
    })
    for (let j = 0; j < (index % 3 === 0 ? 4 : 3); j++) {
      const [merchantId] = merchants[j]
      const sourceId = j === 3 ? 'demo-used' : 'demo'
      const externalId = id + '-' + j
      await db.offer.upsert({
        where: { sourceId_externalId: { sourceId, externalId } },
        update: {},
        create: {
          sourceId,
          externalId,
          merchantId,
          productId: id,
          title: name,
          url: 'https://example.com/?produkt=' + id,
          price: (price + (j === 3 ? -Math.round(price * 0.24) : j * 13)) * 100,
          shipping: [499, 0, null, 699][j],
          condition: j === 3 ? 'used' : 'new',
          availability: j === 2 ? 'unknown' : 'in',
          confidence: 100,
          sellerType: j === 3 ? 'private' : 'business',
          location: j === 3 ? 'Bratislava' : null,
          listedAt: j === 3 ? new Date() : null,
        },
      })
    }
  }
  for (const id of ['demo', 'demo-used'])
    await db.dataSource.update({
      where: { id },
      data: { updatedAt: new Date() },
    })
}
run()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
