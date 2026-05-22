import { api } from '../services/http'

const DEFAULT_ALLOWED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'avif']

const FORMAT_ERROR_MESSAGE =
  'El formato de la imagen no es correcto. Usa PNG, JPG, JPEG, WEBP o AVIF.'
const SUSPICIOUS_FILENAME_ERROR_MESSAGE =
  'El formato de la imagen no es correcto. No se permiten archivos con nombres como imagen.php.jpg.'

const FORMAT_MIME_TYPES = {
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

export const ACCEPTED_IMAGE_INPUT_TYPES =
  '.jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif'

function normalizeFormats(formats) {
  const normalized = (
    Array.isArray(formats) && formats.length
      ? formats
      : DEFAULT_ALLOWED_IMAGE_FORMATS
  )
    .map((format) =>
      String(format || '')
        .trim()
        .toLowerCase()
    )
    .filter(Boolean)

  return [...new Set(normalized)]
}

function getFormatAliases(format) {
  if (format === 'jpg' || format === 'jpeg') {
    return ['jpg', 'jpeg']
  }

  return [format]
}

function isAllowedFormat(format, allowedFormats) {
  const normalizedFormat = String(format || '')
    .trim()
    .toLowerCase()

  if (!normalizedFormat) {
    return false
  }

  return getFormatAliases(normalizedFormat).some((alias) =>
    allowedFormats.includes(alias)
  )
}

function getAllowedMimeTypes(allowedFormats) {
  return [
    ...new Set(
      allowedFormats.flatMap((format) => FORMAT_MIME_TYPES[format] || [])
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

function asciiFromBytes(bytes, start, end) {
  return String.fromCharCode(...bytes.slice(start, end))
}

function detectImageFormatFromBytes(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'jpg'
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png'
  }

  if (
    bytes.length >= 12 &&
    asciiFromBytes(bytes, 0, 4) === 'RIFF' &&
    asciiFromBytes(bytes, 8, 12) === 'WEBP'
  ) {
    return 'webp'
  }

  if (bytes.length >= 12 && asciiFromBytes(bytes, 4, 8) === 'ftyp') {
    const brands = asciiFromBytes(bytes, 8, Math.min(bytes.length, 32))

    if (brands.includes('avif') || brands.includes('avis')) {
      return 'avif'
    }
  }

  if (bytes.length >= 6) {
    const header = asciiFromBytes(bytes, 0, 6)

    if (header === 'GIF87a' || header === 'GIF89a') {
      return 'gif'
    }
  }

  return ''
}

export async function validateImageFile(
  file,
  allowedFormats = DEFAULT_ALLOWED_IMAGE_FORMATS
) {
  if (!file) {
    throw new Error(FORMAT_ERROR_MESSAGE)
  }

  const normalizedFormats = normalizeFormats(allowedFormats)
  const extensions = getFileExtensions(file.name)
  const finalExtension = extensions.at(-1) || ''

  if (!finalExtension || !isAllowedFormat(finalExtension, normalizedFormats)) {
    throw new Error(FORMAT_ERROR_MESSAGE)
  }

  if (hasDangerousIntermediateExtension(extensions)) {
    throw new Error(SUSPICIOUS_FILENAME_ERROR_MESSAGE)
  }

  const mimeType = String(file.type || '')
    .trim()
    .toLowerCase()

  if (mimeType) {
    const allowedMimeTypes = getAllowedMimeTypes(normalizedFormats)

    if (!allowedMimeTypes.includes(mimeType)) {
      throw new Error(FORMAT_ERROR_MESSAGE)
    }
  }

  const headerBytes = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  const detectedFormat = detectImageFormatFromBytes(headerBytes)

  if (!detectedFormat || !isAllowedFormat(detectedFormat, normalizedFormats)) {
    throw new Error(FORMAT_ERROR_MESSAGE)
  }
}

function getCloudinaryUploadErrorMessage(message, fallbackErrorMessage) {
  const normalizedMessage = String(message || '').toLowerCase()

  if (
    normalizedMessage.includes('invalid image') ||
    normalizedMessage.includes('invalid file') ||
    normalizedMessage.includes('format') ||
    normalizedMessage.includes('allowed')
  ) {
    return FORMAT_ERROR_MESSAGE
  }

  return message
    ? `No se pudo subir la imagen a Cloudinary: ${message}`
    : fallbackErrorMessage || 'No se pudo subir la imagen a Cloudinary.'
}

export async function signAndUploadManagedImage({
  file,
  entityType,
  campaignId = null,
  tags = [],
  fallbackErrorMessage = 'No se pudo subir la imagen a Cloudinary.',
}) {
  await validateImageFile(file)

  const signPayload = {
    entityType,
    campaignId: campaignId || null,
    tags,
    size: file.size,
  }

  if (file.name) {
    signPayload.fileName = file.name
  }

  if (file.type) {
    signPayload.mimeType = file.type
  }

  const { data: signature } = await api.post('/media/sign-upload', signPayload)

  await validateImageFile(file, signature.allowedFormats)

  if (file.size > signature.maxBytes) {
    throw new Error(
      `La imagen supera el limite de ${Math.round(signature.maxBytes / 1024)} KB.`
    )
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', signature.apiKey)
  formData.append('timestamp', String(signature.timestamp))
  formData.append('signature', signature.signature)
  formData.append('folder', signature.folder)
  formData.append('tags', signature.tags.join(','))

  if (signature.allowedFormats?.length) {
    formData.append('allowed_formats', signature.allowedFormats.join(','))
  }

  if (signature.context && Object.keys(signature.context).length) {
    formData.append(
      'context',
      Object.entries(signature.context)
        .map(([key, value]) => `${key}=${value}`)
        .join('|')
    )
  }

  const response = await fetch(signature.uploadUrl, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    let cloudinaryMessage = ''

    try {
      const errorPayload = await response.json()
      cloudinaryMessage = errorPayload?.error?.message || ''
    } catch {
      cloudinaryMessage = ''
    }

    throw new Error(
      getCloudinaryUploadErrorMessage(cloudinaryMessage, fallbackErrorMessage)
    )
  }

  const payload = await response.json()
  return payload.secure_url
}
