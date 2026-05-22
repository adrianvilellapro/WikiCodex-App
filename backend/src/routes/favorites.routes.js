const { Router } = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/async-handler')
const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const {
  FAVORITE_ENTITY_TYPES,
  getFavoriteStatus,
  listFavoritesForUser,
  setFavorite,
} = require('../services/favorite.service')

const favoritesRouter = Router()

const favoriteEntitySchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    entityType: z.enum(FAVORITE_ENTITY_TYPES),
    entityId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const listFavoritesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
  }),
})

const setFavoriteSchema = z.object({
  body: z
    .object({
      favorito: z.boolean(),
    })
    .strict(),
  params: favoriteEntitySchema.shape.params,
  query: z.object({}).strict(),
})

favoritesRouter.use(requireAuth)

favoritesRouter.get(
  '/',
  validate(listFavoritesSchema),
  asyncHandler(async (req, res) => {
    const result = await listFavoritesForUser({
      req,
      limit: req.validated.query.limit || 20,
    })

    res.json(result)
  })
)

favoritesRouter.get(
  '/:entityType/:entityId',
  validate(favoriteEntitySchema),
  asyncHandler(async (req, res) => {
    const result = await getFavoriteStatus({
      req,
      entityType: req.validated.params.entityType,
      entityId: req.validated.params.entityId,
    })

    res.json(result)
  })
)

favoritesRouter.put(
  '/:entityType/:entityId',
  validate(setFavoriteSchema),
  asyncHandler(async (req, res) => {
    const result = await setFavorite({
      req,
      entityType: req.validated.params.entityType,
      entityId: req.validated.params.entityId,
      favorito: req.validated.body.favorito,
    })

    res.json(result)
  })
)

module.exports = {
  favoritesRouter,
}
