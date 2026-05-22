const path = require('path')

const { env } = require('../config/env')
const { cloudinary } = require('./cloudinary')

const EXTERNAL_RESOURCE_FOLDER = `${env.CLOUDINARY_FOLDER_ROOT}/resources/external`
const RESOURCE_METADATA_CACHE_TTL_MS = 5 * 60 * 1000
const resourceMetadataCache = new Map()

function getCacheEntry(fileName) {
  const entry = resourceMetadataCache.get(fileName)

  if (!entry || entry.expiresAt < Date.now()) {
    resourceMetadataCache.delete(fileName)
    return null
  }

  return entry
}

function getExternalResourcePublicId(fileName) {
  return `${EXTERNAL_RESOURCE_FOLDER}/${path.basename(fileName)}`
}

async function isExternalResourceUploadedToCloudinary(fileName) {
  const cachedEntry = getCacheEntry(fileName)

  if (cachedEntry) {
    return cachedEntry.exists
  }

  let exists = false

  try {
    await cloudinary.api.resource(getExternalResourcePublicId(fileName), {
      resource_type: 'raw',
    })
    exists = true
  } catch {
    exists = false
  }

  resourceMetadataCache.set(fileName, {
    exists,
    expiresAt: Date.now() + RESOURCE_METADATA_CACHE_TTL_MS,
  })

  return exists
}

function getExternalResourceCloudinaryUrl(fileName, options = {}) {
  return cloudinary.utils.private_download_url(
    getExternalResourcePublicId(fileName),
    '',
    {
      resource_type: 'raw',
      type: 'upload',
      attachment: Boolean(options.attachment),
    }
  )
}

module.exports = {
  EXTERNAL_RESOURCE_FOLDER,
  getExternalResourceCloudinaryUrl,
  getExternalResourcePublicId,
  isExternalResourceUploadedToCloudinary,
}
