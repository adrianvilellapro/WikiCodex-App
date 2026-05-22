const { Router } = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/async-handler')
const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const {
  createFeat,
  deleteFeat,
  getFeatDetail,
  getFeatOptions,
  listFeats,
  updateFeat,
} = require('../services/feat.service')

const featsRouter = Router()

const featPayloadSchema = z
  .object({
    nombre: z.string().trim().min(1).max(180),
    slug: z.string().trim().max(200).nullable().optional(),
    idiomaCodigo: z.enum(['en', 'es']).optional().default('en'),
    fuente: z.string().trim().max(80).nullable().optional(),
    edicion: z.string().trim().max(80).nullable().optional(),
    categoria: z.string().trim().max(80).nullable().optional(),
    prerrequisitos: z.array(z.unknown()).optional(),
    descripcion: z.string().trim().max(80000).nullable().optional(),
    resumen: z.string().trim().max(1200).nullable().optional(),
    beneficios: z.array(z.unknown()).optional(),
    datosFuente: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

const listFeatsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    q: z.string().trim().max(120).optional().default(''),
    idioma: z.enum(['en', 'es']).optional(),
    fuentes: z.string().trim().max(1200).optional(),
    ediciones: z.string().trim().max(240).optional(),
    sort: z
      .enum([
        'name_asc',
        'name_desc',
        'created_desc',
        'created_asc',
        'updated_desc',
        'updated_asc',
      ])
      .optional()
      .default('name_asc'),
  }),
})

const featIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ featId: z.string().uuid() }),
  query: z.object({}).strict(),
})

function parseCsvValues(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

featsRouter.use(requireAuth)

featsRouter.get(
  '/options',
  asyncHandler(async (_req, res) => {
    res.json(await getFeatOptions())
  })
)

featsRouter.get(
  '/',
  validate(listFeatsSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await listFeats({
        req,
        limit: req.validated.query.limit || 200,
        filters: {
          q: req.validated.query.q,
          idioma: req.validated.query.idioma,
          fuentes: parseCsvValues(req.validated.query.fuentes),
          ediciones: parseCsvValues(req.validated.query.ediciones),
          sort: req.validated.query.sort,
        },
      })
    )
  })
)

featsRouter.post(
  '/',
  validate(
    z.object({
      body: featPayloadSchema,
      params: z.object({}).strict(),
      query: z.object({}).strict(),
    })
  ),
  asyncHandler(async (req, res) => {
    const item = await createFeat({ req, payload: req.validated.body })
    res.status(201).json(item)
  })
)

featsRouter.get(
  '/:featId',
  validate(featIdSchema),
  asyncHandler(async (req, res) => {
    res.json(await getFeatDetail({ req, featId: req.validated.params.featId }))
  })
)

featsRouter.patch(
  '/:featId',
  validate(
    z.object({
      body: featPayloadSchema,
      params: featIdSchema.shape.params,
      query: z.object({}).strict(),
    })
  ),
  asyncHandler(async (req, res) => {
    res.json(
      await updateFeat({
        req,
        featId: req.validated.params.featId,
        payload: req.validated.body,
      })
    )
  })
)

featsRouter.delete(
  '/:featId',
  validate(featIdSchema),
  asyncHandler(async (req, res) => {
    res.json(await deleteFeat({ req, featId: req.validated.params.featId }))
  })
)

module.exports = {
  featsRouter,
}
