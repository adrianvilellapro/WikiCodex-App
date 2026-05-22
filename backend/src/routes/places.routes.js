const { Router } = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/async-handler')
const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const {
  deletePlace,
  getPlaceArchiveMetadata,
  getPlaceEditorMetadata,
  getVisiblePlaceGraph,
  listPlaceArchivePage,
  listOwnPlacesForEditor,
  listOwnPlaceTreesForEditor,
  listPlaceVersions,
  listVisiblePlaces,
  requirePlaceViewAccess,
  savePlaceDraft,
  serializePlace,
} = require('../services/place.service')

const placesRouter = Router()
const PLACE_NAME_MAX_LENGTH = 250

const placeIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    placeId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const listPlacesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(500).optional(),
      cursor: z.coerce.number().int().min(0).optional(),
      q: z.string().trim().max(120).optional().default(''),
      matchMode: z.enum(['all', 'any']).optional().default('all'),
      sort: z
        .enum([
          'created_desc',
          'created_asc',
          'name_asc',
          'name_desc',
          'type_asc',
          'type_desc',
        ])
        .optional()
        .default('created_desc'),
      tipoLugarIds: z.string().trim().max(5000).optional().default(''),
      campaignIds: z.string().trim().max(5000).optional().default(''),
    })
    .strict(),
})

const placeArchiveOptionsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const ownPlacesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.coerce.number().int().min(0).optional(),
    search: z.string().trim().max(120).optional(),
    excludePlaceId: z.string().uuid().nullable().optional(),
  }),
})

const ownPlaceTreesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
    cursor: z.coerce.number().int().min(0).optional(),
    search: z.string().trim().max(120).optional(),
    placeId: z.string().uuid().nullable().optional(),
  }),
})

const editorPayloadSchema = z.object({
  body: z
    .object({
      core: z
        .object({
          campanaIds: z.array(z.string().uuid()).optional().default([]),
          tipoLugarId: z.string().uuid().nullable().optional(),
          lugarBaseId: z.string().uuid().nullable().optional(),
          lugarPadreId: z.string().uuid().nullable().optional(),
          nombre: z.string().trim().min(1).max(PLACE_NAME_MAX_LENGTH),
          descripcion: z.string().trim().nullable().optional(),
          imagenPrincipalUrl: z.string().url().nullable().optional(),
        })
        .strict(),
      galeria: z
        .array(
          z
            .object({
              id: z.string().uuid().nullable().optional(),
              imagenUrl: z.string().url(),
              titulo: z.string().trim().max(160).nullable().optional(),
            })
            .strict()
        )
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
    placeId: z.string().uuid().optional(),
  }),
  query: z.object({}).strict(),
})

function parseCsvValues(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

placesRouter.use(requireAuth)

placesRouter.get(
  '/',
  validate(listPlacesSchema),
  asyncHandler(async (req, res) => {
    const query = req.validated.query
    const legacyList =
      !req.query.q &&
      !req.query.matchMode &&
      !req.query.sort &&
      !req.query.tipoLugarIds &&
      !req.query.campaignIds
    const items = legacyList
      ? await listVisiblePlaces({
          req,
          limit: query.limit || 30,
          cursor: query.cursor || 0,
        })
      : await listPlaceArchivePage({
          req,
          limit: query.limit || 30,
          cursor: query.cursor || 0,
          filters: {
            q: query.q,
            matchMode: query.matchMode,
            sort: query.sort,
            tipoLugarIds: parseCsvValues(query.tipoLugarIds),
            campaignIds: parseCsvValues(query.campaignIds),
          },
        })

    res.json(items)
  })
)

placesRouter.get(
  '/archive/options',
  validate(placeArchiveOptionsSchema),
  asyncHandler(async (_req, res) => {
    const options = await getPlaceArchiveMetadata()
    res.json(options)
  })
)

placesRouter.get(
  '/editor/new',
  asyncHandler(async (req, res) => {
    const result = await getPlaceEditorMetadata({ req })
    res.json(result)
  })
)

placesRouter.get(
  '/editor/own-places',
  validate(ownPlacesSchema),
  asyncHandler(async (req, res) => {
    const result = await listOwnPlacesForEditor({
      req,
      limit: req.validated.query.limit || 5,
      cursor: req.validated.query.cursor || 0,
      search: req.validated.query.search || '',
      excludePlaceId: req.validated.query.excludePlaceId || null,
    })

    res.json(result)
  })
)

placesRouter.get(
  '/editor/own-place-trees',
  validate(ownPlaceTreesSchema),
  asyncHandler(async (req, res) => {
    const result = await listOwnPlaceTreesForEditor({
      req,
      limit: req.validated.query.limit || 4,
      cursor: req.validated.query.cursor || 0,
      search: req.validated.query.search || '',
      placeId: req.validated.query.placeId || null,
    })

    res.json(result)
  })
)

placesRouter.post(
  '/editor',
  validate(editorPayloadSchema),
  asyncHandler(async (req, res) => {
    const item = await savePlaceDraft({
      req,
      payload: req.validated.body,
    })

    res.status(201).json({ item })
  })
)

placesRouter.get(
  '/:placeId',
  validate(placeIdSchema),
  asyncHandler(async (req, res) => {
    const context = await requirePlaceViewAccess(
      req.validated.params.placeId,
      req
    )

    res.json({
      item: serializePlace(context.place, context.access),
    })
  })
)

placesRouter.get(
  '/:placeId/editor',
  validate(placeIdSchema),
  asyncHandler(async (req, res) => {
    const result = await getPlaceEditorMetadata({
      placeId: req.validated.params.placeId,
      req,
    })

    res.json(result)
  })
)

placesRouter.put(
  '/:placeId/editor',
  validate(editorPayloadSchema),
  asyncHandler(async (req, res) => {
    const item = await savePlaceDraft({
      placeId: req.validated.params.placeId,
      req,
      payload: req.validated.body,
    })

    res.json({ item })
  })
)

placesRouter.get(
  '/:placeId/versions',
  validate(placeIdSchema),
  asyncHandler(async (req, res) => {
    const result = await listPlaceVersions({
      placeId: req.validated.params.placeId,
      req,
    })
    res.json(result)
  })
)

placesRouter.get(
  '/:placeId/graph',
  validate(placeIdSchema),
  asyncHandler(async (req, res) => {
    await requirePlaceViewAccess(req.validated.params.placeId, req)

    const result = await getVisiblePlaceGraph({
      placeId: req.validated.params.placeId,
      req,
    })
    res.json(result)
  })
)

placesRouter.delete(
  '/:placeId',
  validate(placeIdSchema),
  asyncHandler(async (req, res) => {
    await deletePlace({
      placeId: req.validated.params.placeId,
      req,
    })

    res.status(204).send()
  })
)

module.exports = {
  placesRouter,
}
