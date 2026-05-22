const fs = require('fs')
const path = require('path')
const { Router } = require('express')
const { z } = require('zod')

const { asyncHandler } = require('../lib/async-handler')
const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const { createHttpError } = require('../lib/errors')
const { isExternalResourceFile } = require('../config/external-resources')
const {
  getExternalResourceCloudinaryUrl,
  isExternalResourceUploadedToCloudinary,
} = require('../lib/external-resource-cloudinary')

const resourcesRouter = Router()
const resourceDirectory = path.resolve(__dirname, '../../resources/external')

const resourceFileSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    fileName: z.string().min(1).max(160),
  }),
  query: z.object({}).strict(),
})

resourcesRouter.use(requireAuth)

resourcesRouter.get(
  '/external/:fileName/download',
  validate(resourceFileSchema),
  asyncHandler(async (req, res) => {
    const { fileName } = req.validated.params

    if (!isExternalResourceFile(fileName)) {
      throw createHttpError(404, 'Recurso no encontrado.')
    }

    if (await isExternalResourceUploadedToCloudinary(fileName)) {
      return res.redirect(
        getExternalResourceCloudinaryUrl(fileName, { attachment: true })
      )
    }

    const filePath = path.join(resourceDirectory, fileName)

    if (!fs.existsSync(filePath)) {
      throw createHttpError(404, 'El PDF todavia no esta disponible.')
    }

    return res.download(filePath, fileName)
  })
)

resourcesRouter.get(
  '/external/:fileName',
  validate(resourceFileSchema),
  asyncHandler(async (req, res) => {
    const { fileName } = req.validated.params

    if (!isExternalResourceFile(fileName)) {
      throw createHttpError(404, 'Recurso no encontrado.')
    }

    if (!(await isExternalResourceUploadedToCloudinary(fileName))) {
      return res.json({
        fileName,
        source: 'backend',
        downloadPath: `/resources/external/${fileName}/download`,
      })
    }

    res.json({
      fileName,
      source: 'cloudinary',
      viewUrl: getExternalResourceCloudinaryUrl(fileName),
      downloadUrl: getExternalResourceCloudinaryUrl(fileName, {
        attachment: true,
      }),
    })
  })
)

module.exports = {
  resourcesRouter,
}
