import nodemailer from 'nodemailer'
import { db } from './db'
import { euro, total } from './domain'

interface Notifier {
  channel: string
  send(email: string, product: string, amount: number): Promise<void>
}
function notifier(local: boolean): Notifier | null {
  if (local)
    return {
      channel: 'log',
      async send(_email, product, amount) {
        console.info('[PriceFinder test]', product, euro(amount))
      },
    }
  if (!process.env.SMTP_URL || !process.env.SMTP_FROM) return null
  const transport = nodemailer.createTransport(process.env.SMTP_URL)
  return {
    channel: 'email',
    async send(to, product, amount) {
      await transport.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: 'Cenové upozornenie PriceFinder',
        text: product + ' stojí ' + euro(amount) + ' vrátane dopravy.',
      })
    },
  }
}
export async function evaluateAlerts(local = false) {
  const adapter = notifier(local)
  if (!adapter) return { status: 'disabled', sent: 0, failed: 0 }
  let sent = 0,
    failed = 0
  const stale = new Date(Date.now() - 15 * 60 * 1000)
  const alerts = await db.priceAlert.findMany({
    where: {
      notifiedAt: null,
      OR: [{ processing: null }, { processing: { lt: stale } }],
    },
    include: {
      product: {
        include: {
          offers: {
            where: {
              availability: 'in',
              source: { enabled: true, ...(!local && { demo: false }) },
            },
          },
        },
      },
    },
  })
  for (const alert of alerts) {
    const amount = Math.min(
      ...alert.product.offers.map((o) => total(o) ?? Infinity),
    )
    if (amount > alert.target || (!local && alert.product.demo)) continue
    const processing = new Date()
    const claimed = await db.priceAlert.updateMany({
      where: {
        id: alert.id,
        notifiedAt: null,
        OR: [{ processing: null }, { processing: { lt: stale } }],
      },
      data: { processing },
    })
    if (!claimed.count) continue
    try {
      await adapter.send(alert.email, alert.product.name, amount)
      await db.priceAlert.update({
        where: { id: alert.id },
        data: {
          notifiedAt: new Date(),
          channel: adapter.channel,
          processing: null,
        },
      })
      sent++
    } catch {
      await db.priceAlert.updateMany({
        where: { id: alert.id, processing },
        data: { processing: null },
      })
      failed++
    }
  }
  return { status: adapter.channel, sent, failed }
}
