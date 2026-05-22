const { Router } = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/async-handler')
const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const {
  createPower,
  deletePower,
  getPowerDetail,
  getPowerOptions,
  listPowers,
  updatePower,
} = require('../services/power.service')

const powersRouter = Router()
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const WIKICODEX_CAMPAIGN_FILTER_ID = '__wikicodex'
const NO_CAMPAIGN_SELECTION_FILTER_ID = '__none'

const permissionSchema = z
  .object({
    usuarioId: z.string().uuid(),
    nivelAccesoCodigo: z.enum(['completo', 'vista_previa']),
  })
  .strict()

const powerPayloadSchema = z
  .object({
    nombre: z.string().trim().min(1).max(150),
    descripcion: z.string().trim().max(50000).nullable().optional(),
    imagenUrl: z.string().url().nullable().optional(),
    categorias: z.array(z.string().trim().min(1).max(80)).optional(),
    campanaIds: z.array(z.string().uuid()).optional(),
    ambitoVisibilidadCodigo: z
      .enum([
        'privado',
        'usuarios_seleccionados',
        'campana_vista_previa',
        'campana_completo',
      ])
      .optional(),
    permisosUsuarios: z.array(permissionSchema).optional(),
  })
  .strict()

const listPowersSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    cursor: z.coerce.number().int().min(0).optional(),
    q: z.string().trim().max(120).optional().default(''),
    matchMode: z.enum(['all', 'any']).optional().default('all'),
    sort: z
      .enum([
        'created_desc',
        'created_asc',
        'updated_desc',
        'updated_asc',
        'name_asc',
        'name_desc',
      ])
      .optional()
      .default('created_desc'),
    campaignId: z.string().uuid().optional(),
    campaignIds: z
      .string()
      .trim()
      .max(5000)
      .optional()
      .default('')
      .refine(
        (value) =>
          parseCsvValues(value).every(
            (item) =>
              item === WIKICODEX_CAMPAIGN_FILTER_ID ||
              item === NO_CAMPAIGN_SELECTION_FILTER_ID ||
              UUID_REGEX.test(item)
          ),
        'campaignIds debe contener UUIDs separados por comas.'
      ),
    createdByUserId: z.string().uuid().optional(),
    categoria: z.string().trim().max(80).optional(),
    categoryIds: z
      .string()
      .trim()
      .max(5000)
      .optional()
      .default('')
      .refine(
        (value) => parseCsvValues(value).every((item) => UUID_REGEX.test(item)),
        'categoryIds debe contener UUIDs separados por comas.'
      ),
  }),
})

const powerIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ powerId: z.string().uuid() }),
  query: z.object({}).strict(),
})

function parseCsvValues(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

powersRouter.use(requireAuth)

powersRouter.get(
  '/options',
  asyncHandler(async (req, res) => {
    res.json(await getPowerOptions({ req }))
  })
)

powersRouter.get(
  '/',
  validate(listPowersSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await listPowers({
        req,
        limit: req.validated.query.limit || 20,
        cursor: req.validated.query.cursor || 0,
        filters: {
          q: req.validated.query.q,
          matchMode: req.validated.query.matchMode,
          sort: req.validated.query.sort,
          campaignId: req.validated.query.campaignId,
          campaignIds: parseCsvValues(req.validated.query.campaignIds),
          createdByUserId: req.validated.query.createdByUserId,
          categoria: req.validated.query.categoria,
          categoryIds: parseCsvValues(req.validated.query.categoryIds),
        },
      })
    )
  })
)

powersRouter.post(
  '/',
  validate(
    z.object({
      body: powerPayloadSchema,
      params: z.object({}).strict(),
      query: z.object({}).strict(),
    })
  ),
  asyncHandler(async (req, res) => {
    const item = await createPower({ req, payload: req.validated.body })
    res.status(201).json(item)
  })
)

powersRouter.get(
  '/:powerId',
  validate(powerIdSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await getPowerDetail({
        req,
        powerId: req.validated.params.powerId,
      })
    )
  })
)

powersRouter.patch(
  '/:powerId',
  validate(
    z.object({
      body: powerPayloadSchema,
      params: powerIdSchema.shape.params,
      query: z.object({}).strict(),
    })
  ),
  asyncHandler(async (req, res) => {
    res.json(
      await updatePower({
        req,
        powerId: req.validated.params.powerId,
        payload: req.validated.body,
      })
    )
  })
)

powersRouter.delete(
  '/:powerId',
  validate(powerIdSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await deletePower({
        req,
        powerId: req.validated.params.powerId,
      })
    )
  })
)

module.exports = {
  powersRouter,
}
