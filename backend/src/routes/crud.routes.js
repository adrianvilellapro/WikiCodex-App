const { Router } = require('express')

const { prisma } = require('../lib/prisma')
const { asyncHandler } = require('../lib/async-handler')
const { createHttpError } = require('../lib/errors')
const { requireAuth } = require('../middlewares/auth.middleware')
const { resourceConfigs } = require('./crud.config')

const crudRouter = Router()
const RESERVED_QUERY_PARAMS = new Set(['limit', 'skip', 'sortBy', 'sortOrder'])

function getResourceConfig(resourceName) {
  const config = resourceConfigs[resourceName]

  if (!config) {
    throw createHttpError(404, `El recurso "${resourceName}" no existe.`)
  }

  return {
    primaryKey: 'id',
    hiddenFields: [],
    allowCreate: true,
    allowUpdate: true,
    allowDelete: true,
    ...config,
  }
}

function assertRoleAllowed(config, req, action) {
  const allowedRoles = action === 'write' ? config.writeRoles : config.readRoles

  if (!allowedRoles.includes(req.auth.roleCode)) {
    throw createHttpError(
      403,
      'No tienes permisos para acceder a este recurso.',
      {
        recurso: req.params.resource,
        accion: action,
        allowedRoles,
      }
    )
  }
}

function sanitizeRecord(record, hiddenFields) {
  if (!record || typeof record !== 'object') {
    return record
  }

  if (Array.isArray(record)) {
    return record.map((item) => sanitizeRecord(item, hiddenFields))
  }

  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !hiddenFields.includes(key))
      .map(([key, value]) => [key, sanitizeRecord(value, hiddenFields)])
  )
}

function parseQueryValue(value) {
  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  if (/^-?\d+$/.test(value)) {
    return Number(value)
  }

  return value
}

function buildWhereFromQuery(query) {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([key]) => !RESERVED_QUERY_PARAMS.has(key))
      .map(([key, value]) => [key, parseQueryValue(value)])
  )
}

function cleanPayload(payload, config) {
  const protectedFields = new Set([
    config.primaryKey,
    'id',
    'creado_en',
    'actualizado_en',
  ])

  return Object.fromEntries(
    Object.entries(payload || {}).filter(
      ([key, value]) => !protectedFields.has(key) && value !== undefined
    )
  )
}

function getDelegate(config) {
  return prisma[config.delegate]
}

async function fetchExistingRecord(delegate, config, id) {
  return delegate.findUnique({
    where: {
      [config.primaryKey]: id,
    },
    include: config.include,
  })
}

crudRouter.use(requireAuth)

crudRouter.get('/', (_req, res) => {
  const resources = Object.entries(resourceConfigs).map(([slug, config]) => ({
    slug,
    delegate: config.delegate,
    primaryKey: config.primaryKey || 'id',
    allowCreate: config.allowCreate !== false,
    allowDelete: config.allowDelete !== false,
    readRoles: config.readRoles,
    writeRoles: config.writeRoles,
  }))

  res.json({
    resources,
  })
})

crudRouter.get(
  '/:resource',
  asyncHandler(async (req, res) => {
    const config = getResourceConfig(req.params.resource)
    assertRoleAllowed(config, req, 'read')

    const limit = Math.min(Number(req.query.limit || 25), 100)
    const skip = Number(req.query.skip || 0)
    const where = buildWhereFromQuery(req.query)
    const sortBy = req.query.sortBy
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc'

    const delegate = getDelegate(config)
    const queryOptions = {
      where,
      skip,
      take: limit,
    }

    if (config.include) {
      queryOptions.include = config.include
    }

    if (sortBy) {
      queryOptions.orderBy = { [sortBy]: sortOrder }
    }

    const [items, total] = await Promise.all([
      delegate.findMany(queryOptions),
      delegate.count({ where }),
    ])

    res.json({
      items: sanitizeRecord(items, config.hiddenFields),
      meta: {
        total,
        limit,
        skip,
      },
    })
  })
)

crudRouter.get(
  '/:resource/:id',
  asyncHandler(async (req, res) => {
    const config = getResourceConfig(req.params.resource)
    assertRoleAllowed(config, req, 'read')

    const delegate = getDelegate(config)
    const item = await delegate.findUnique({
      where: {
        [config.primaryKey]: req.params.id,
      },
      include: config.include,
    })

    if (!item) {
      throw createHttpError(404, 'No se ha encontrado el registro solicitado.')
    }

    res.json({
      item: sanitizeRecord(item, config.hiddenFields),
    })
  })
)

crudRouter.post(
  '/:resource',
  asyncHandler(async (req, res) => {
    const config = getResourceConfig(req.params.resource)
    assertRoleAllowed(config, req, 'write')

    if (config.allowCreate === false) {
      throw createHttpError(
        405,
        `El recurso "${req.params.resource}" no permite creacion manual.`
      )
    }

    const delegate = getDelegate(config)
    let data = cleanPayload(req.body, config)

    if (config.transformCreate) {
      data = config.transformCreate(data, req)
    }

    if (config.beforeCreate) {
      await config.beforeCreate({
        req,
        data,
      })
    }

    const created = await delegate.create({
      data,
      include: config.include,
    })

    if (config.afterCreate) {
      await config.afterCreate({
        req,
        created,
        data,
      })
    }

    res.status(201).json({
      item: sanitizeRecord(created, config.hiddenFields),
    })
  })
)

crudRouter.patch(
  '/:resource/:id',
  asyncHandler(async (req, res) => {
    const config = getResourceConfig(req.params.resource)
    assertRoleAllowed(config, req, 'write')

    if (config.allowUpdate === false) {
      throw createHttpError(
        405,
        `El recurso "${req.params.resource}" no permite edicion manual.`
      )
    }

    const delegate = getDelegate(config)
    const existing =
      config.afterUpdate || config.beforeUpdate
        ? await fetchExistingRecord(delegate, config, req.params.id)
        : null
    let data = cleanPayload(req.body, config)

    if (config.transformUpdate) {
      data = config.transformUpdate(data, req)
    }

    if (config.beforeUpdate) {
      await config.beforeUpdate({
        req,
        id: req.params.id,
        existing,
        data,
      })
    }

    const updated = await delegate.update({
      where: {
        [config.primaryKey]: req.params.id,
      },
      data,
      include: config.include,
    })

    if (config.afterUpdate) {
      await config.afterUpdate({
        req,
        id: req.params.id,
        existing,
        updated,
        data,
      })
    }

    res.json({
      item: sanitizeRecord(updated, config.hiddenFields),
    })
  })
)

crudRouter.delete(
  '/:resource/:id',
  asyncHandler(async (req, res) => {
    const config = getResourceConfig(req.params.resource)
    assertRoleAllowed(config, req, 'write')

    if (config.allowDelete === false) {
      throw createHttpError(
        405,
        `El recurso "${req.params.resource}" no permite borrado manual.`
      )
    }

    const delegate = getDelegate(config)
    const existing =
      config.beforeDelete || config.afterDelete
        ? await fetchExistingRecord(delegate, config, req.params.id)
        : null

    if (config.beforeDelete) {
      await config.beforeDelete({
        req,
        id: req.params.id,
        existing,
      })
    }

    const deleted = await delegate.delete({
      where: {
        [config.primaryKey]: req.params.id,
      },
    })

    if (config.afterDelete) {
      await config.afterDelete({
        req,
        id: req.params.id,
        existing,
        deleted,
      })
    }

    res.status(204).send()
  })
)

module.exports = {
  crudRouter,
}
