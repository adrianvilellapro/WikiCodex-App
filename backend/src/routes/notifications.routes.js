const { Router } = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/async-handler')
const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const {
  deleteAllNotificationsForUser,
  deleteNotificationForUser,
  getNotificationSummary,
  listNotificationsForUser,
} = require('../services/notification.service')

const notificationsRouter = Router()

const listNotificationsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
})

const notificationIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    notificationId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

notificationsRouter.use(requireAuth)

notificationsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const summary = await getNotificationSummary(req.auth.userId)
    res.json(summary)
  })
)

notificationsRouter.get(
  '/',
  validate(listNotificationsSchema),
  asyncHandler(async (req, res) => {
    const result = await listNotificationsForUser({
      usuarioId: req.auth.userId,
      limit: req.validated.query.limit || 20,
    })

    res.json(result)
  })
)

notificationsRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    await deleteAllNotificationsForUser(req.auth.userId)
    res.status(204).send()
  })
)

notificationsRouter.delete(
  '/:notificationId',
  validate(notificationIdSchema),
  asyncHandler(async (req, res) => {
    await deleteNotificationForUser({
      notificationId: req.validated.params.notificationId,
      usuarioId: req.auth.userId,
    })
    res.status(204).send()
  })
)

module.exports = {
  notificationsRouter,
}
