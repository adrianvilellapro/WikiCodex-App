const { Router } = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/async-handler')
const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const {
  MODIFIER_TYPE_CODES,
  OBJECT_TYPE_CODES,
  deleteObject,
  getObjectArchiveMetadata,
  getObjectEditorMetadata,
  listObjectArchivePage,
  listObjectVersions,
  listVisibleObjects,
  requireObjectViewAccess,
  saveObjectDraft,
  serializeObject,
} = require('../services/object.service')

const objectsRouter = Router()

const longTextField = z.string().trim().nullable().optional()
const OBJECT_NAME_MAX_LENGTH = 250
const MODIFIER_OTHER_MAX_LENGTH = 120

const objectIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    objectId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const optionalQueryNumber = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) {
    return undefined
  }

  if (typeof value === 'string') {
    return Number(value.trim().replace(',', '.'))
  }

  return value
}, z.number().optional())

const listObjectsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(500).optional(),
      cursor: z.coerce.number().int().min(0).optional(),
      view: z.enum(['objects', 'tierlist']).optional().default('objects'),
      q: z.string().trim().max(120).optional().default(''),
      matchMode: z.enum(['all', 'any']).optional().default('all'),
      sort: z
        .enum([
          'created_desc',
          'created_asc',
          'name_asc',
          'name_desc',
          'modifier_asc',
          'modifier_desc',
        ])
        .optional()
        .default('created_desc'),
      tierIds: z.string().trim().max(5000).optional().default(''),
      campaignIds: z.string().trim().max(5000).optional().default(''),
      tipoMagicoCodigos: z.string().trim().max(120).optional().default(''),
      modifierTypeCodes: z.string().trim().max(500).optional().default(''),
      modifierMin: optionalQueryNumber,
      modifierMax: optionalQueryNumber,
    })
    .strict(),
})

const objectArchiveOptionsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const editorPayloadSchema = z.object({
  body: z
    .object({
      core: z
        .object({
          campanaIds: z.array(z.string().uuid()).optional().default([]),
          propietarioUsuarioId: z.string().uuid().nullable().optional(),
          objetoBaseId: z.string().uuid().nullable().optional(),
          tierId: z.string().uuid().nullable().optional(),
          tipoMagicoCodigo: z.enum(OBJECT_TYPE_CODES).optional(),
          nombre: z.string().trim().min(1).max(OBJECT_NAME_MAX_LENGTH),
          descripcion: longTextField,
          imagenPrincipalUrl: z.string().url().nullable().optional(),
        })
        .strict(),
      modificador: z
        .object({
          valor: z.number().int().nullable().optional(),
          tipoCodigo: z.enum(MODIFIER_TYPE_CODES).nullable().optional(),
          otro: z
            .string()
            .trim()
            .max(MODIFIER_OTHER_MAX_LENGTH)
            .nullable()
            .optional(),
        })
        .strict()
        .optional(),
      modificadores: z
        .array(
          z
            .object({
              id: z.string().uuid().nullable().optional(),
              valor: z.number().int(),
              tipoCodigo: z.enum(MODIFIER_TYPE_CODES),
              otro: z
                .string()
                .trim()
                .max(MODIFIER_OTHER_MAX_LENGTH)
                .nullable()
                .optional(),
            })
            .strict()
        )
        .optional(),
      rasgos: z
        .array(
          z
            .object({
              id: z.string().uuid().nullable().optional(),
              tipoRasgoId: z.string().uuid().nullable().optional(),
              nombre: z.string().trim().min(1).max(200),
              descripcion: z.string().trim().min(1),
            })
            .strict()
        )
        .optional(),
      rasgosAgrupados: z
        .array(
          z
            .object({
              tipoRasgoId: z.string().uuid().nullable().optional(),
              nombre: z.string().trim().min(1).max(120),
              ordenVisualizacion: z.number().int().optional(),
              rasgos: z.array(
                z
                  .object({
                    id: z.string().uuid().nullable().optional(),
                    nombre: z.string().trim().min(1).max(200),
                    descripcion: z.string().trim().min(1),
                  })
                  .strict()
              ),
            })
            .strict()
        )
        .optional(),
      hechizos: z
        .array(
          z
            .object({
              hechizoId: z.string().uuid(),
            })
            .strict()
        )
        .optional(),
      hechizosSlots: z
        .record(z.string(), z.number().int().min(0).max(999))
        .optional(),
      privacidad: z
        .object({
          mode: z.enum(['private', 'public', 'preview', 'custom']).optional(),
          userPermissions: z
            .array(
              z
                .object({
                  usuarioId: z.string().uuid(),
                  nivelAccesoCodigo: z.enum(['full', 'preview', 'hidden']),
                })
                .strict()
            )
            .optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
  params: z.object({
    objectId: z.string().uuid().optional(),
  }),
  query: z.object({}).strict(),
})

function parseCsvValues(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseOptionalNumber(value) {
  return Number.isFinite(value) ? value : null
}

objectsRouter.use(requireAuth)

objectsRouter.get(
  '/',
  validate(listObjectsSchema),
  asyncHandler(async (req, res) => {
    const query = req.validated.query
    const legacyList =
      !req.query.view &&
      !req.query.q &&
      !req.query.matchMode &&
      !req.query.sort &&
      !req.query.tierIds &&
      !req.query.campaignIds &&
      !req.query.tipoMagicoCodigos &&
      !req.query.modifierTypeCodes &&
      req.query.modifierMin === undefined &&
      req.query.modifierMax === undefined
    const items = legacyList
      ? await listVisibleObjects({
          req,
          limit: query.limit || 30,
          cursor: query.cursor || 0,
        })
      : await listObjectArchivePage({
          req,
          limit: query.limit || 30,
          cursor: query.cursor || 0,
          filters: {
            view: query.view,
            q: query.q,
            matchMode: query.matchMode,
            sort: query.sort,
            tierIds: parseCsvValues(query.tierIds),
            campaignIds: parseCsvValues(query.campaignIds),
            tipoMagicoCodigos: parseCsvValues(query.tipoMagicoCodigos),
            modifierTypeCodes: parseCsvValues(query.modifierTypeCodes),
            modifierMin: parseOptionalNumber(query.modifierMin),
            modifierMax: parseOptionalNumber(query.modifierMax),
          },
        })

    res.json(items)
  })
)

objectsRouter.get(
  '/archive/options',
  validate(objectArchiveOptionsSchema),
  asyncHandler(async (_req, res) => {
    const options = await getObjectArchiveMetadata()
    res.json(options)
  })
)

objectsRouter.get(
  '/editor/new',
  asyncHandler(async (req, res) => {
    const result = await getObjectEditorMetadata({ req })
    res.json(result)
  })
)

objectsRouter.post(
  '/editor',
  validate(editorPayloadSchema),
  asyncHandler(async (req, res) => {
    const item = await saveObjectDraft({
      req,
      payload: req.validated.body,
    })

    res.status(201).json({ item })
  })
)

objectsRouter.get(
  '/:objectId',
  validate(objectIdSchema),
  asyncHandler(async (req, res) => {
    const { objectId } = req.validated.params
    const context = await requireObjectViewAccess(objectId, req, {
      includeLinkedCharacters: true,
    })

    res.json({
      item: serializeObject(context.object, context.access, req),
    })
  })
)

objectsRouter.get(
  '/:objectId/editor',
  validate(objectIdSchema),
  asyncHandler(async (req, res) => {
    const { objectId } = req.validated.params
    const result = await getObjectEditorMetadata({ objectId, req })
    res.json(result)
  })
)

objectsRouter.put(
  '/:objectId/editor',
  validate(editorPayloadSchema),
  asyncHandler(async (req, res) => {
    const { objectId } = req.validated.params
    const item = await saveObjectDraft({
      objectId,
      req,
      payload: req.validated.body,
    })

    res.json({ item })
  })
)

objectsRouter.get(
  '/:objectId/versions',
  validate(objectIdSchema),
  asyncHandler(async (req, res) => {
    const { objectId } = req.validated.params
    const result = await listObjectVersions({ objectId, req })
    res.json(result)
  })
)

objectsRouter.delete(
  '/:objectId',
  validate(objectIdSchema),
  asyncHandler(async (req, res) => {
    await deleteObject({
      objectId: req.validated.params.objectId,
      req,
    })

    res.status(204).send()
  })
)

module.exports = {
  objectsRouter,
}
