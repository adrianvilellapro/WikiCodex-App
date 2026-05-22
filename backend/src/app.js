const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')

const { env } = require('./config/env')
const { apiRouter } = require('./routes')
const { errorHandler } = require('./middlewares/error.middleware')
const { apiRateLimit } = require('./middlewares/rate-limit.middleware')

function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  )
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  )
  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'))
  }
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: false, limit: '2mb' }))

  app.get('/', (_req, res) => {
    res.json({
      name: 'WikiCodex API',
      status: 'ok',
      version: '1.0.0',
    })
  })

  app.use('/api', apiRateLimit)
  app.use('/api', apiRouter)

  app.use((req, res) => {
    res.status(404).json({
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    })
  })
  app.use(errorHandler)

  return app
}

module.exports = {
  createApp,
}
