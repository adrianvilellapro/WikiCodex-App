const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const globalForPrisma = globalThis
const globalForPgPool = globalThis

const pool =
  globalForPgPool.prismaPgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
  })

const adapter = new PrismaPg(pool)
const shouldLogQueries = process.env.PRISMA_LOG_QUERIES === 'true'
const prismaLogLevels = shouldLogQueries
  ? ['query', 'info', 'warn', 'error']
  : process.env.NODE_ENV === 'development'
    ? ['info', 'warn', 'error']
    : ['error']

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: prismaLogLevels,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPgPool.prismaPgPool = pool
}

module.exports = {
  prisma,
  pool,
}
