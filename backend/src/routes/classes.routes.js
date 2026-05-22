const { Router } = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/async-handler')
const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const {
  createClass,
  deleteClass,
  getClassDetail,
  getClassOptions,
  getSubclassDetail,
  listClasses,
  updateClass,
} = require('../services/class.service')

const classesRouter = Router()
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const WIKICODEX_CAMPAIGN_FILTER_ID = '__wikicodex'
const NO_CAMPAIGN_SELECTION_FILTER_ID = '__none'

function parseCsvValues(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const subclassSchema = z
  .object({
    id: z.string().uuid().optional(),
    nombre: z.string().trim().min(1).max(160),
    slug: z.string().trim().max(180).nullable().optional(),
    fuente: z.string().trim().max(80).nullable().optional(),
    descripcion: z.string().trim().max(50000).nullable().optional(),
    resumen: z.string().trim().max(5000).nullable().optional(),
    rasgos: z.array(z.unknown()).optional(),
    datosFuente: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

const classPayloadSchema = z
  .object({
    nombre: z.string().trim().min(1).max(160),
    slug: z.string().trim().max(180).nullable().optional(),
    idiomaCodigo: z.enum(['en', 'es']).optional().default('en'),
    fuente: z.string().trim().max(80).nullable().optional(),
    edicion: z.string().trim().max(80).nullable().optional(),
    categoriaCatalogo: z.string().trim().max(80).nullable().optional(),
    descripcion: z.string().trim().max(80000).nullable().optional(),
    resumen: z.string().trim().max(5000).nullable().optional(),
    icono: z.string().trim().max(80).nullable().optional(),
    dadoGolpeCaras: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .nullable()
      .optional(),
    salvaciones: z.array(z.string().trim().max(80)).optional(),
    competencias: z.record(z.string(), z.unknown()).optional(),
    equipoInicial: z.array(z.unknown()).optional(),
    tabla: z.array(z.unknown()).optional(),
    rasgos: z.array(z.unknown()).optional(),
    datosFuente: z.record(z.string(), z.unknown()).optional(),
    campanaIds: z.array(z.string().uuid()).optional(),
    subclases: z.array(subclassSchema).optional(),
  })
  .strict()

const listClassesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    q: z.string().trim().max(120).optional().default(''),
    idioma: z.enum(['en', 'es']).optional(),
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
    ediciones: z.string().trim().max(200).optional().default(''),
  }),
})

const classIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ classId: z.string().uuid() }),
  query: z.object({}).strict(),
})

const subclassIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    classId: z.string().uuid(),
    subclassId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

classesRouter.use(requireAuth)

classesRouter.get(
  '/options',
  asyncHandler(async (req, res) => {
    res.json(await getClassOptions({ req }))
  })
)

classesRouter.get(
  '/',
  validate(listClassesSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await listClasses({
        req,
        limit: req.validated.query.limit || 200,
        filters: {
          q: req.validated.query.q,
          idioma: req.validated.query.idioma,
          sort: req.validated.query.sort,
          campaignIds: parseCsvValues(req.validated.query.campaignIds),
          ediciones: parseCsvValues(req.validated.query.ediciones),
        },
      })
    )
  })
)

classesRouter.post(
  '/',
  validate(
    z.object({
      body: classPayloadSchema,
      params: z.object({}).strict(),
      query: z.object({}).strict(),
    })
  ),
  asyncHandler(async (req, res) => {
    const item = await createClass({ req, payload: req.validated.body })
    res.status(201).json(item)
  })
)

classesRouter.get(
  '/:classId/subclases/:subclassId',
  validate(subclassIdSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await getSubclassDetail({
        req,
        classId: req.validated.params.classId,
        subclassId: req.validated.params.subclassId,
      })
    )
  })
)

classesRouter.get(
  '/:classId',
  validate(classIdSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await getClassDetail({ req, classId: req.validated.params.classId })
    )
  })
)

classesRouter.patch(
  '/:classId',
  validate(
    z.object({
      body: classPayloadSchema,
      params: classIdSchema.shape.params,
      query: z.object({}).strict(),
    })
  ),
  asyncHandler(async (req, res) => {
    res.json(
      await updateClass({
        req,
        classId: req.validated.params.classId,
        payload: req.validated.body,
      })
    )
  })
)

classesRouter.delete(
  '/:classId',
  validate(classIdSchema),
  asyncHandler(async (req, res) => {
    res.json(await deleteClass({ req, classId: req.validated.params.classId }))
  })
)

module.exports = {
  classesRouter,
}
