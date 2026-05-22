const { Router } = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/async-handler')
const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const {
  COMMENT_MAX_LENGTH,
  COMMENT_TARGETS,
  createCommentForTarget,
  deleteComment,
  listCommentsForTarget,
  updateComment,
} = require('../services/comment.service')

const commentsRouter = Router()
const targetTypeSchema = z.enum(Object.keys(COMMENT_TARGETS))

const targetSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    targetType: targetTypeSchema,
    targetId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const commentPayloadSchema = z.object({
  contenido: z.string().trim().min(1).max(COMMENT_MAX_LENGTH),
})

const createCommentSchema = z.object({
  body: commentPayloadSchema.strict(),
  params: targetSchema.shape.params,
  query: z.object({}).strict(),
})

const commentIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    commentId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const updateCommentSchema = z.object({
  body: commentPayloadSchema.strict(),
  params: commentIdSchema.shape.params,
  query: z.object({}).strict(),
})

commentsRouter.use(requireAuth)

commentsRouter.get(
  '/:targetType/:targetId',
  validate(targetSchema),
  asyncHandler(async (req, res) => {
    const { targetType, targetId } = req.validated.params

    res.json(
      await listCommentsForTarget({
        targetType,
        targetId,
        req,
      })
    )
  })
)

commentsRouter.post(
  '/:targetType/:targetId',
  validate(createCommentSchema),
  asyncHandler(async (req, res) => {
    const { targetType, targetId } = req.validated.params
    const item = await createCommentForTarget({
      targetType,
      targetId,
      contenido: req.validated.body.contenido,
      req,
    })

    res.status(201).json({ item })
  })
)

commentsRouter.patch(
  '/:commentId',
  validate(updateCommentSchema),
  asyncHandler(async (req, res) => {
    const item = await updateComment({
      commentId: req.validated.params.commentId,
      contenido: req.validated.body.contenido,
      req,
    })

    res.json({ item })
  })
)

commentsRouter.delete(
  '/:commentId',
  validate(commentIdSchema),
  asyncHandler(async (req, res) => {
    await deleteComment({
      commentId: req.validated.params.commentId,
      req,
    })

    res.status(204).send()
  })
)

module.exports = {
  commentsRouter,
}
