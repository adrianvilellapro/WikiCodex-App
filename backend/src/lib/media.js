const path = require('path')

const { cloudinary } = require('./cloudinary')
const { env } = require('../config/env')
const { createHttpError } = require('./errors')

const MEDIA_METADATA_CACHE_TTL_MS = 5 * 60 * 1000
const allowedImageFormats = env.CLOUDINARY_ALLOWED_IMAGE_FORMATS.split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean)
const IMAGE_FORMAT_ERROR_MESSAGE =
  'El formato de la imagen no es correcto. Usa PNG, JPG, JPEG, WEBP o AVIF.'
const SUSPICIOUS_IMAGE_FILENAME_ERROR_MESSAGE =
  'El formato de la imagen no es correcto. No se permiten archivos con nombres como imagen.php.jpg.'
const IMAGE_MIME_TYPES_BY_FORMAT = {
  avif: ['image/avif'],
  gif: ['image/gif'],
  jpg: ['image/jpeg', 'image/pjpeg'],
  jpeg: ['image/jpeg', 'image/pjpeg'],
  png: ['image/png', 'image/x-png'],
  webp: ['image/webp'],
}
const DANGEROUS_FILENAME_EXTENSIONS = new Set([
  'asp',
  'aspx',
  'bat',
  'cmd',
  'cgi',
  'com',
  'dll',
  'exe',
  'htm',
  'html',
  'jar',
  'js',
  'jsp',
  'mjs',
  'msi',
  'phtml',
  'php',
  'phar',
  'pl',
  'ps1',
  'py',
  'rb',
  'sh',
  'svg',
  'vbs',
  'wsf',
])
const mediaMetadataCache = new Map()

function getImageFormatAliases(format) {
  const normalizedFormat = String(format || '')
    .trim()
    .toLowerCase()

  if (normalizedFormat === 'jpg' || normalizedFormat === 'jpeg') {
    return ['jpg', 'jpeg']
  }

  return normalizedFormat ? [normalizedFormat] : []
}

function isAllowedImageFormat(format, formats = allowedImageFormats) {
  const normalizedFormats = formats.map((item) =>
    String(item || '')
      .trim()
      .toLowerCase()
  )

  return getImageFormatAliases(format).some((alias) =>
    normalizedFormats.includes(alias)
  )
}

function getAllowedImageMimeTypes(formats = allowedImageFormats) {
  return [
    ...new Set(
      formats.flatMap((format) => IMAGE_MIME_TYPES_BY_FORMAT[format] || [])
    ),
  ]
}

function getFileExtensions(fileName) {
  const safeName = String(fileName || '')
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .pop()

  if (!safeName || !safeName.includes('.')) {
    return []
  }

  return safeName
    .split('.')
    .slice(1)
    .map((extension) => extension.trim().toLowerCase())
    .filter(Boolean)
}

function hasDangerousIntermediateExtension(extensions) {
  return extensions
    .slice(0, -1)
    .some((extension) => DANGEROUS_FILENAME_EXTENSIONS.has(extension))
}

function normalizeEntitySegment(value) {
  return String(value || 'general')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildCloudinaryFolder({ entityType, campaignId }) {
  const segments = [env.CLOUDINARY_FOLDER_ROOT]
  const normalizedEntityType = normalizeEntitySegment(entityType)

  if (campaignId) {
    segments.push('campanas', campaignId)
  }

  segments.push(normalizedEntityType)

  return segments.join('/')
}

function getMetadataCacheKey(assetInfo) {
  return `${assetInfo.resourceType}:${assetInfo.publicId}`
}

function getCachedAssetMetadata(assetInfo) {
  const cacheKey = getMetadataCacheKey(assetInfo)
  const cachedEntry = mediaMetadataCache.get(cacheKey)

  if (!cachedEntry) {
    return null
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    mediaMetadataCache.delete(cacheKey)
    return null
  }

  return cachedEntry.value
}

function setCachedAssetMetadata(assetInfo, value) {
  const cacheKey = getMetadataCacheKey(assetInfo)

  mediaMetadataCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + MEDIA_METADATA_CACHE_TTL_MS,
  })
}

function isCloudinaryUrl(url) {
  if (!url) {
    return false
  }

  try {
    const parsed = new URL(url)
    return parsed.hostname === 'res.cloudinary.com'
  } catch {
    return false
  }
}

function extractCloudinaryAssetInfo(url) {
  if (!isCloudinaryUrl(url)) {
    return null
  }

  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)

    if (segments.length < 4) {
      return null
    }

    const cloudName = segments[0]
    const resourceType = segments[1]
    const uploadSegmentIndex = segments.indexOf('upload')

    if (cloudName !== env.CLOUDINARY_CLOUD_NAME || uploadSegmentIndex === -1) {
      return null
    }

    const publicSegments = segments
      .slice(uploadSegmentIndex + 1)
      .filter(
        (segment) =>
          !/^v\d+$/.test(segment) &&
          !segment.startsWith('c_') &&
          !segment.startsWith('f_') &&
          !segment.startsWith('q_')
      )

    if (publicSegments.length === 0) {
      return null
    }

    const lastSegment = publicSegments[publicSegments.length - 1]
    const extension = path.extname(lastSegment)

    if (extension) {
      publicSegments[publicSegments.length - 1] = lastSegment.slice(
        0,
        -extension.length
      )
    }

    return {
      publicId: decodeURIComponent(publicSegments.join('/')),
      resourceType,
    }
  } catch {
    return null
  }
}

async function getCloudinaryAssetDetailsByUrl(url, options = {}) {
  const assetInfo = extractCloudinaryAssetInfo(url)

  if (!assetInfo) {
    return null
  }

  if (!options.forceRefresh) {
    const cachedValue = getCachedAssetMetadata(assetInfo)

    if (cachedValue) {
      return cachedValue
    }
  }

  const details = await cloudinary.api.resource(assetInfo.publicId, {
    resource_type: assetInfo.resourceType,
  })

  setCachedAssetMetadata(assetInfo, details)

  return details
}

async function destroyCloudinaryAssetByUrl(url) {
  const assetInfo = extractCloudinaryAssetInfo(url)

  if (!assetInfo) {
    return null
  }

  const result = await cloudinary.uploader.destroy(assetInfo.publicId, {
    resource_type: assetInfo.resourceType,
    invalidate: true,
  })

  mediaMetadataCache.delete(getMetadataCacheKey(assetInfo))

  return result
}

async function cleanupCloudinaryAssets(urls = []) {
  const uniqueUrls = [...new Set(urls.filter(Boolean))]

  if (uniqueUrls.length === 0) {
    return {
      deleted: [],
      skipped: [],
      failed: [],
    }
  }

  const settled = await Promise.allSettled(
    uniqueUrls.map(async (url) => ({
      url,
      result: await destroyCloudinaryAssetByUrl(url),
    }))
  )

  return settled.reduce(
    (acc, item, index) => {
      const url = uniqueUrls[index]

      if (item.status === 'rejected') {
        acc.failed.push({
          url,
          error: item.reason?.message || 'Cloudinary cleanup failed.',
        })
        return acc
      }

      if (!item.value.result) {
        acc.skipped.push(url)
        return acc
      }

      acc.deleted.push({
        url,
        result: item.value.result.result || item.value.result,
      })

      return acc
    },
    {
      deleted: [],
      skipped: [],
      failed: [],
    }
  )
}

function validateImageUploadCandidate({
  fileName = '',
  mimeType = '',
  size = null,
} = {}) {
  const extensions = getFileExtensions(fileName)
  const finalExtension = extensions.at(-1) || ''

  if (fileName && !isAllowedImageFormat(finalExtension)) {
    throw createHttpError(400, IMAGE_FORMAT_ERROR_MESSAGE, {
      formatosPermitidos: allowedImageFormats,
    })
  }

  if (hasDangerousIntermediateExtension(extensions)) {
    throw createHttpError(400, SUSPICIOUS_IMAGE_FILENAME_ERROR_MESSAGE, {
      formatosPermitidos: allowedImageFormats,
    })
  }

  const normalizedMimeType = String(mimeType || '')
    .trim()
    .toLowerCase()

  if (normalizedMimeType) {
    const allowedMimeTypes = getAllowedImageMimeTypes()

    if (!allowedMimeTypes.includes(normalizedMimeType)) {
      throw createHttpError(400, IMAGE_FORMAT_ERROR_MESSAGE, {
        tiposMimePermitidos: allowedMimeTypes,
      })
    }
  }

  if (
    size !== null &&
    size !== undefined &&
    size > env.CLOUDINARY_IMAGE_MAX_BYTES
  ) {
    throw createHttpError(
      400,
      `La imagen supera el tamano maximo permitido de ${env.CLOUDINARY_IMAGE_MAX_BYTES} bytes.`,
      {
        bytes: size,
        maxBytes: env.CLOUDINARY_IMAGE_MAX_BYTES,
      }
    )
  }
}

function createSignedUploadPayload({
  entityType,
  campaignId,
  tags = [],
  context = {},
}) {
  const folder = buildCloudinaryFolder({ entityType, campaignId })
  const timestamp = Math.floor(Date.now() / 1000)
  const normalizedTags = [
    'wikicodex',
    normalizeEntitySegment(entityType),
    ...tags.map(normalizeEntitySegment).filter(Boolean),
  ]
  const normalizedContext = Object.entries(context)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
    .reduce((acc, [key, value]) => {
      acc[normalizeEntitySegment(key)] = String(value)
      return acc
    }, {})

  const signablePayload = {
    folder,
    timestamp,
    tags: normalizedTags.join(','),
    allowed_formats: allowedImageFormats.join(','),
  }

  if (Object.keys(normalizedContext).length > 0) {
    signablePayload.context = Object.entries(normalizedContext)
      .map(([key, value]) => `${key}=${value}`)
      .join('|')
  }

  const signature = cloudinary.utils.api_sign_request(
    signablePayload,
    env.CLOUDINARY_API_SECRET
  )

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    folder,
    timestamp,
    signature,
    tags: normalizedTags,
    context: normalizedContext,
    resourceType: 'image',
    allowedFormats: allowedImageFormats,
    acceptedMimeTypes: getAllowedImageMimeTypes(),
    maxBytes: env.CLOUDINARY_IMAGE_MAX_BYTES,
  }
}

async function assertManagedImageUrl(url, options = {}) {
  if (!url) {
    return null
  }

  const entityLabel = options.entityLabel || 'La imagen'
  const assetInfo = extractCloudinaryAssetInfo(url)

  if (!assetInfo) {
    throw createHttpError(
      400,
      `${entityLabel} debe ser una URL valida de Cloudinary gestionada por WikiCodex.`
    )
  }

  if (assetInfo.resourceType !== 'image') {
    await cleanupCloudinaryAssets([url])
    throw createHttpError(400, IMAGE_FORMAT_ERROR_MESSAGE, {
      resourceType: assetInfo.resourceType,
    })
  }

  let details

  try {
    details = await getCloudinaryAssetDetailsByUrl(url, options)
  } catch (error) {
    throw createHttpError(
      400,
      `${entityLabel} no existe en Cloudinary o no se puede validar ahora mismo.`,
      {
        cloudinaryError: error.message,
      }
    )
  }

  const normalizedFormat = String(details.format || '').toLowerCase()

  if (!isAllowedImageFormat(normalizedFormat)) {
    await cleanupCloudinaryAssets([url])
    throw createHttpError(400, IMAGE_FORMAT_ERROR_MESSAGE, {
      formato: normalizedFormat,
      formatosPermitidos: allowedImageFormats,
    })
  }

  if (details.bytes > env.CLOUDINARY_IMAGE_MAX_BYTES) {
    await cleanupCloudinaryAssets([url])
    throw createHttpError(
      400,
      `${entityLabel} supera el tamano maximo permitido de ${env.CLOUDINARY_IMAGE_MAX_BYTES} bytes.`,
      {
        bytes: details.bytes,
        maxBytes: env.CLOUDINARY_IMAGE_MAX_BYTES,
      }
    )
  }

  return details
}

module.exports = {
  allowedImageFormats,
  assertManagedImageUrl,
  buildCloudinaryFolder,
  cleanupCloudinaryAssets,
  createSignedUploadPayload,
  destroyCloudinaryAssetByUrl,
  extractCloudinaryAssetInfo,
  getCloudinaryAssetDetailsByUrl,
  isCloudinaryUrl,
  validateImageUploadCandidate,
}
