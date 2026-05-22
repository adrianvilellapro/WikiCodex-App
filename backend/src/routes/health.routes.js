const { Router } = require('express')
const { prisma } = require('../lib/prisma')
const { env } = require('../config/env')

const healthRouter = Router()

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'backend',
    timestamp: new Date().toISOString(),
  })
})

healthRouter.get('/db', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`

    res.json({
      status: 'ok',
      service: 'database',
      provider: 'postgresql',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

healthRouter.get('/media', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'cloudinary',
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    folderRoot: env.CLOUDINARY_FOLDER_ROOT,
    timestamp: new Date().toISOString(),
  })
})

module.exports = {
  healthRouter,
}
