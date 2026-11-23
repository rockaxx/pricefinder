import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
const cookie = 'pricefinder_admin'
function sign(expires: number, secret: string) {
  return createHmac('sha256', secret)
    .update('admin:' + expires)
    .digest('hex')
}
export function same(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
export async function isAdmin() {
  const secret = process.env.ADMIN_TOKEN
  const value = (await cookies()).get(cookie)?.value || ''
  const [exp, digest] = value.split('.')
  const expires = Number(exp)
  return Boolean(
    secret &&
    secret.length >= 24 &&
    expires > Date.now() &&
    digest &&
    same(digest, sign(expires, secret)),
  )
}
export async function startAdmin(secret: string) {
  const expires = Date.now() + 8 * 3600000
  await (
    await cookies()
  ).set(cookie, expires + '.' + sign(expires, secret), {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.SITE_URL?.startsWith('https:') ?? false,
    expires: new Date(expires),
  })
}
export async function endAdmin() {
  ;(await cookies()).delete(cookie)
}
