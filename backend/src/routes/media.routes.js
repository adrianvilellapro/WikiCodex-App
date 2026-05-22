const { Router } = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/async-handler')
const {
  createSignedUploadPayload,
  validateImageUploadCandidate,
} = require('../lib/media')
const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')

const mediaRouter = Router()

const signUploadSchema = z.object({
  body: z
    .object({
      entityType: z
        .string()
        .trim()
        .min(1)
        .max(40)
        .regex(/^[A-Za-z0-9_-]+$/),
      campaignId: z.string().uuid().nullable().optional(),
      fileName: z.string().trim().min(1).max(240).optional(),
      mimeType: z.string().trim().min(1).max(120).optional(),
      size: z.number().int().positive().optional(),
      tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

mediaRouter.use(requireAuth)

mediaRouter.post(
  '/sign-upload',
  validate(signUploadSchema),
  asyncHandler(async (req, res) => {
    const {
      entityType,
      campaignId,
      fileName,
      mimeType,
      size,
      tags = [],
    } = req.validated.body

    validateImageUploadCandidate({
      fileName,
      mimeType,
      size,
    })

    const payload = createSignedUploadPayload({
      entityType,
      campaignId,
      tags,
      context: {
        entity_type: entityType,
        campaign_id: campaignId || '',
        actor_user_id: req.auth.userId,
      },
    })

    res.json(payload)
  })
)

module.exports = {
  mediaRouter,
}
