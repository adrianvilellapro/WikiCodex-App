const { Router } = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/async-handler')
const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const {
  WIKI_TYPES,
  resolveWikiReferences,
  searchWikiEntities,
} = require('../services/wiki-text.service')

const wikiRouter = Router()

const searchSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      tipo: z.string().trim().min(1).max(40),
      q: z.string().trim().max(120).optional().default(''),
      limit: z.coerce.number().int().min(1).max(20).optional().default(8),
    })
    .strict(),
})

const resolveSchema = z.object({
  body: z
    .object({
      referencias: z
        .array(
          z
            .object({
              key: z.string().min(1).max(220).optional(),
              tipo: z.string().trim().min(1).max(40),
              nombre: z.string().trim().min(1).max(180),
            })
            .strict()
        )
        .max(80)
        .default([]),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

wikiRouter.use(requireAuth)

wikiRouter.get(
  '/types',
  asyncHandler(async (_req, res) => {
    res.json({ items: WIKI_TYPES })
  })
)

wikiRouter.get(
  '/search',
  validate(searchSchema),
  asyncHandler(async (req, res) => {
    const { tipo, q, limit } = req.validated.query
    const items = await searchWikiEntities({
      req,
      type: tipo,
      query: q,
      limit,
    })

    res.json({ items })
  })
)

wikiRouter.post(
  '/resolve',
  validate(resolveSchema),
  asyncHandler(async (req, res) => {
    const result = await resolveWikiReferences({
      req,
      references: req.validated.body.referencias,
    })

    res.json(result)
  })
)

module.exports = {
  wikiRouter,
}
