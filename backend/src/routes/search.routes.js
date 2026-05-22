const { Router } = require('express')
const { z } = require('zod')

const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const { asyncHandler } = require('../lib/async-handler')
const {
  SEARCH_TYPES,
  searchGlobal,
} = require('../services/global-search.service')

const searchRouter = Router()

const searchSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      q: z.string().trim().min(1).max(80),
      limit: z.coerce.number().int().min(1).max(10).optional(),
      types: z
        .string()
        .trim()
        .max(120)
        .optional()
        .transform((value) =>
          value
            ? value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            : SEARCH_TYPES
        ),
    })
    .strict(),
})

searchRouter.use(requireAuth)

searchRouter.get(
  '/',
  validate(searchSchema),
  asyncHandler(async (req, res) => {
    const result = await searchGlobal({
      req,
      query: req.validated.query.q,
      limit: req.validated.query.limit || 6,
      types: req.validated.query.types,
    })

    res.json(result)
  })
)

module.exports = {
  searchRouter,
}
