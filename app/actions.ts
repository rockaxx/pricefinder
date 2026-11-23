'use server'
import { z } from 'zod'
import { db } from '../lib/db'
import { cents } from '../lib/domain'
export async function createAlert(
  productId: string,
  _previous: string,
  form: FormData,
) {
  const email = z
    .email()
    .max(254)
    .safeParse(
      String(form.get('email') || '')
        .trim()
        .toLowerCase(),
    )
  const target = cents(String(form.get('target') || ''))
  if (!email.success || !target) return 'Zadaj platný e-mail a kladnú cenu.'
  try {
    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) return 'Produkt sa nenašiel.'
    const row = { email: email.data, target, productId }
    await db.priceAlert.upsert({
      where: {
        productId_email_target: { productId, email: row.email, target },
      },
      create: row,
      update: {},
    })
    return product.demo || !process.env.SMTP_URL || !process.env.SMTP_FROM
      ? 'Upozornenie uložené. Pre túto ponuku sa e-mail neposiela.'
      : 'Cenové upozornenie uložené.'
  } catch (error) {
    console.error(
      'Alert storage failed',
      error instanceof Error ? error.name : 'unknown',
    )
    return 'Upozornenie sa nepodarilo uložiť.'
  }
}
