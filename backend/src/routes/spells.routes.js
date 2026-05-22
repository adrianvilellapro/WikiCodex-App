const { Router } = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/async-handler')
const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const {
  createSpell,
  deleteSpell,
  getSpellCatalogOptions,
  getSpellDetail,
  listSpells,
  saveSpellGroup,
  setSpellSaved,
  updateSpell,
} = require('../services/spell.service')

const spellsRouter = Router()

const spellPayloadSchema = z.object({
  nombre: z.string().trim().min(1).max(150),
  nivel: z.number().int().min(0).max(10).optional(),
  escuela: z.string().trim().max(100).nullable().optional(),
  alcancePies: z.number().int().min(0).max(9_999_999_999).nullable().optional(),
  componentes: z
    .object({
      verbal: z.boolean().optional(),
      somatico: z.boolean().optional(),
      material: z.string().trim().max(1000).optional(),
      consumeMaterial: z.boolean().optional(),
    })
    .optional(),
  duracion: z.string().trim().max(120).nullable().optional(),
  duracionPersonalizada: z.string().trim().max(200).nullable().optional(),
  clases: z.array(z.string().trim().min(1).max(80)).optional(),
  tipoCasteo: z.string().trim().max(120).nullable().optional(),
  concentracion: z.boolean().optional(),
  tipoAtaque: z.string().trim().max(120).nullable().optional(),
  tiposDano: z.array(z.string().trim().min(1).max(80)).optional(),
  condiciones: z.array(z.string().trim().min(1).max(80)).optional(),
  miscelanea: z.array(z.string().trim().min(1).max(120)).optional(),
  tipoSalvacion: z.string().trim().max(120).nullable().optional(),
  pruebaHabilidad: z.string().trim().max(120).nullable().optional(),
  rango: z.string().trim().max(120).nullable().optional(),
  estiloArea: z.string().trim().max(120).nullable().optional(),
  criaturasAfectadas: z.array(z.string().trim().min(1).max(80)).optional(),
  descripcion: z.string().trim().max(50000).nullable().optional(),
  descripcionHtml: z.string().trim().max(50000).nullable().optional(),
  fuente: z.string().trim().max(200).nullable().optional(),
  esPublico: z.boolean().optional(),
  campanaIds: z.array(z.string().uuid()).optional(),
})

const listSpellsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(250).optional(),
    cursor: z.coerce.number().int().min(0).optional(),
    q: z.string().trim().optional(),
    nivel: z.coerce.number().int().min(0).max(10).optional(),
    escuela: z.string().trim().optional(),
    clase: z.string().trim().optional(),
    niveles: z.string().trim().optional(),
    escuelas: z.string().trim().optional(),
    clases: z.string().trim().optional(),
    classFilters: z.string().trim().optional(),
    tiposDano: z.string().trim().optional(),
    condiciones: z.string().trim().optional(),
    miscelanea: z.string().trim().optional(),
    tiposCasteo: z.string().trim().optional(),
    pruebasSalvaciones: z.string().trim().optional(),
    matchMode: z.enum(['all', 'any']).optional(),
    guardados: z.coerce.boolean().optional(),
    campaignId: z.string().uuid().optional(),
    campaignIds: z.string().trim().optional(),
  }),
})

const spellIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    spellId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const createSpellSchema = z.object({
  body: spellPayloadSchema.strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const saveSpellSchema = z.object({
  body: z
    .object({
      guardado: z.boolean(),
    })
    .strict(),
  params: spellIdSchema.shape.params,
  query: z.object({}).strict(),
})

const bulkSaveSchema = z.object({
  body: z
    .object({
      nivel: z.number().int().min(0).max(10).nullable().optional(),
      escuela: z.string().trim().nullable().optional(),
      clase: z.string().trim().nullable().optional(),
      q: z.string().trim().nullable().optional(),
      niveles: z.string().trim().nullable().optional(),
      escuelas: z.string().trim().nullable().optional(),
      clases: z.string().trim().nullable().optional(),
      classFilters: z.string().trim().nullable().optional(),
      tiposDano: z.string().trim().nullable().optional(),
      condiciones: z.string().trim().nullable().optional(),
      miscelanea: z.string().trim().nullable().optional(),
      tiposCasteo: z.string().trim().nullable().optional(),
      pruebasSalvaciones: z.string().trim().nullable().optional(),
      matchMode: z.enum(['all', 'any']).optional(),
      campaignId: z.string().uuid().nullable().optional(),
      campaignIds: z.string().trim().nullable().optional(),
      guardado: z.boolean().optional(),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

spellsRouter.use(requireAuth)

spellsRouter.get(
  '/options',
  asyncHandler(async (req, res) => {
    res.json(await getSpellCatalogOptions({ req }))
  })
)

spellsRouter.get(
  '/',
  validate(listSpellsSchema),
  asyncHandler(async (req, res) => {
    const result = await listSpells({
      req,
      limit: req.validated.query.limit || 80,
      cursor: req.validated.query.cursor || 0,
      filters: {
        q: req.validated.query.q,
        nivel: req.validated.query.nivel,
        escuela: req.validated.query.escuela,
        clase: req.validated.query.clase,
        niveles: req.validated.query.niveles,
        escuelas: req.validated.query.escuelas,
        clases: req.validated.query.clases,
        classFilters: req.validated.query.classFilters,
        tiposDano: req.validated.query.tiposDano,
        condiciones: req.validated.query.condiciones,
        miscelanea: req.validated.query.miscelanea,
        tiposCasteo: req.validated.query.tiposCasteo,
        pruebasSalvaciones: req.validated.query.pruebasSalvaciones,
        matchMode: req.validated.query.matchMode,
        campaignId: req.validated.query.campaignId,
        campaignIds: req.validated.query.campaignIds,
        onlySaved: Boolean(req.validated.query.guardados),
      },
    })

    res.json(result)
  })
)

spellsRouter.post(
  '/',
  validate(createSpellSchema),
  asyncHandler(async (req, res) => {
    const item = await createSpell({ req, payload: req.validated.body })
    res.status(201).json(item)
  })
)

spellsRouter.post(
  '/bulk-save',
  validate(bulkSaveSchema),
  asyncHandler(async (req, res) => {
    const result = await saveSpellGroup({
      req,
      filters: req.validated.body,
    })
    res.json(result)
  })
)

spellsRouter.get(
  '/:spellId',
  validate(spellIdSchema),
  asyncHandler(async (req, res) => {
    const item = await getSpellDetail({
      req,
      spellId: req.validated.params.spellId,
    })
    res.json(item)
  })
)

spellsRouter.patch(
  '/:spellId',
  validate(
    z.object({
      body: spellPayloadSchema.strict(),
      params: spellIdSchema.shape.params,
      query: z.object({}).strict(),
    })
  ),
  asyncHandler(async (req, res) => {
    const item = await updateSpell({
      req,
      spellId: req.validated.params.spellId,
      payload: req.validated.body,
    })
    res.json(item)
  })
)

spellsRouter.delete(
  '/:spellId',
  validate(spellIdSchema),
  asyncHandler(async (req, res) => {
    const result = await deleteSpell({
      req,
      spellId: req.validated.params.spellId,
    })
    res.json(result)
  })
)

spellsRouter.put(
  '/:spellId/saved',
  validate(saveSpellSchema),
  asyncHandler(async (req, res) => {
    const result = await setSpellSaved({
      req,
      spellId: req.validated.params.spellId,
      saved: req.validated.body.guardado,
    })
    res.json(result)
  })
)

module.exports = {
  spellsRouter,
}
