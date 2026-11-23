import { PrismaClient } from '@prisma/client'
const globalDb = globalThis as typeof globalThis & {
  pricefinder?: PrismaClient
}
export const db = globalDb.pricefinder ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalDb.pricefinder = db
