'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { same, isAdmin, startAdmin, endAdmin } from '../../lib/admin'
import { db } from '../../lib/db'
import { importFeed, sampleMarketplace, sampleXml } from '../../lib/importer'
import { normalize } from '../../lib/domain'
let attempts = 0
let reset = 0
export async function login(form: FormData) {
  const secret = process.env.ADMIN_TOKEN
  if (Date.now() > reset) {
    attempts = 0
    reset = Date.now() + 60000
  }
  if (
    attempts++ >= 10 ||
    !secret ||
    secret.length < 24 ||
    !same(String(form.get('token') || ''), secret)
  )
    redirect('/admin?chyba=prihlasenie')
  await startAdmin(secret)
  redirect('/admin')
}
export async function logout() {
  await endAdmin()
  redirect('/admin')
}
export async function operate(form: FormData) {
  if (!(await isAdmin())) redirect('/admin')
  const id = String(form.get('id') ?? '')
  let failed = false
  try {
    switch (form.get('action')) {
      case 'sample':
        await importFeed('sample', {
          format: 'xml',
          async read() {
            return sampleXml
          },
        })
        break
      case 'sample-used':
        await importFeed('demo-used', sampleMarketplace)
        break
      case 'upload': {
        const file = form.get('file')
        if (!(file instanceof File) || !file.size || file.size > 1_000_000)
          throw Error('Súbor')
        const source = await db.dataSource.findUnique({ where: { id } })
        if (source?.kind !== 'csv' && source?.kind !== 'xml')
          throw Error('Zdroj')
        await importFeed(id, { format: source.kind, read: () => file.text() })
        break
      }
      case 'toggle': {
        const source = await db.dataSource.findUnique({ where: { id } })
        if (
          !source ||
          (source.kind !== 'csv' && source.kind !== 'xml' && !source.demo)
        )
          throw Error('Zdroj')
        await db.dataSource.update({
          where: { id },
          data: { enabled: !source.enabled },
        })
        break
      }
      case 'source': {
        const source = z
          .object({
            name: z.string().trim().min(2).max(100),
            host: z
              .string()
              .toLowerCase()
              .regex(/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/),
            kind: z.enum(['xml', 'csv']),
          })
          .parse(Object.fromEntries(form))
        const key = normalize(source.host).replaceAll(' ', '-')
        await db.$transaction(async (tx) => {
          const merchant = await tx.merchant.upsert({
            where: { id: 'merchant-' + key },
            update: {},
            create: {
              id: 'merchant-' + key,
              name: source.name,
              host: source.host,
            },
          })
          await tx.dataSource.create({
            data: {
              id: key + '-' + source.kind,
              name: source.name,
              kind: source.kind,
              merchantId: merchant.id,
              enabled: true,
            },
          })
        })
        break
      }
      case 'review': {
        const productId = String(form.get('productId') ?? '')
        await db.$transaction(async (tx) => {
          const [offer, p] = await Promise.all([
            tx.offer.findUnique({ where: { id }, include: { source: true } }),
            tx.product.findUnique({ where: { id: productId } }),
          ])
          if (!p || !offer || p.demo !== offer.source.demo)
            throw Error('Párovanie')
          await tx.offer.update({
            where: { id },
            data: { productId, reviewed: true, confidence: 100 },
          })
        })
        break
      }
      case 'create-product': {
        const item = z
          .object({
            name: z.string().trim().min(2).max(120),
            brand: z.string().trim().min(1).max(60),
            model: z.string().trim().min(1).max(90),
            variant: z.string().trim().min(1).max(90),
            categoryId: z.string(),
            gtin: z.string().regex(/^\d{8,14}$|^$/),
          })
          .parse(Object.fromEntries(form))
        const offer = await db.offer.findUnique({
          where: { id },
          include: { source: true },
        })
        if (!offer || offer.source.demo) throw Error('Ponuka')
        const listing = offer.listing as { image?: string } | null
        const slug = normalize(item.name).replaceAll(' ', '-')
        if (!slug) throw Error('Názov')
        await db.$transaction(async (tx) => {
          const existing = await tx.product.findUnique({ where: { id: slug } })
          const productId = existing?.demo ? 'real-' + slug : slug
          await tx.product.create({
            data: {
              ...item,
              id: productId,
              gtin: item.gtin || null,
              images: listing?.image ? [listing.image] : [],
              specs: {
                Výrobca: item.brand,
                Model: item.model,
                Variant: item.variant,
              },
            },
          })
          await tx.offer.update({
            where: { id },
            data: { productId, reviewed: true, confidence: 100 },
          })
        })
        break
      }
      default:
        throw Error('Akcia')
    }
  } catch (error) {
    console.error(
      'Admin operation failed',
      error instanceof Error ? error.name : 'unknown',
    )
    failed = true
  }
  revalidatePath('/', 'layout')
  redirect('/admin?' + (failed ? 'chyba=operacia' : 'hotovo=1'))
}
