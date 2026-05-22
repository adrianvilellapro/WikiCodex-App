import { isDemoMode } from '../demo/config'

const CLOUDINARY_HOST = isDemoMode ? '' : ['res', 'cloudinary', 'com'].join('.')

const imageVariants = {
  avatar: {
    widths: [64, 96, 128],
    aspectRatio: '1:1',
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto:good',
  },
  profileAvatar: {
    widths: [320, 448, 640],
    aspectRatio: null,
    crop: 'fit',
    gravity: null,
    quality: 'auto:good',
  },
  card: {
    widths: [320, 480, 640, 768],
    aspectRatio: '3:4',
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto:good',
  },
  sheetPortrait: {
    widths: [224, 320, 448],
    aspectRatio: '13:16',
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto:good',
  },
  detail: {
    widths: [640, 960, 1280, 1600],
    aspectRatio: null,
    crop: null,
    gravity: null,
    quality: 'auto:good',
  },
}

function parseAspectRatio(value) {
  if (!value) {
    return null
  }

  const [width, height] = value.split(':').map(Number)

  if (!width || !height) {
    return null
  }

  return width / height
}

export function isCloudinaryDeliveryUrl(url) {
  if (!url) {
    return false
  }

  try {
    const parsed = new URL(url)
    return parsed.hostname === CLOUDINARY_HOST
  } catch {
    return false
  }
}

function insertTransformation(url, transformation) {
  if (!isCloudinaryDeliveryUrl(url) || !transformation) {
    return url
  }

  const marker = '/image/upload/'

  if (!url.includes(marker)) {
    return url
  }

  return url.replace(marker, `${marker}${transformation}/`)
}

function buildTransformation({ width, variant }) {
  const variantConfig = imageVariants[variant] || imageVariants.card
  const ratio = parseAspectRatio(variantConfig.aspectRatio)
  const height = ratio ? Math.round(width / ratio) : null

  const parts = [
    `w_${width}`,
    'dpr_auto',
    'f_auto',
    `q_${variantConfig.quality}`,
    'fl_progressive',
    'fl_immutable_cache',
  ]

  if (variantConfig.crop) {
    parts.push(`c_${variantConfig.crop}`)
  }

  if (variantConfig.gravity) {
    parts.push(`g_${variantConfig.gravity}`)
  }

  if (height) {
    parts.push(`h_${height}`)
  }

  return parts.join(',')
}

export function getOptimizedCloudinaryImageUrl(url, options = {}) {
  if (!isCloudinaryDeliveryUrl(url)) {
    return url
  }

  const variant = options.variant || 'card'
  const width =
    options.width ||
    imageVariants[variant]?.widths?.at(-1) ||
    imageVariants.card.widths.at(-1)

  return insertTransformation(url, buildTransformation({ width, variant }))
}

export function getOptimizedCloudinarySrcSet(url, options = {}) {
  if (!isCloudinaryDeliveryUrl(url)) {
    return undefined
  }

  const variant = options.variant || 'card'
  const widths = imageVariants[variant]?.widths || imageVariants.card.widths

  return widths
    .map(
      (width) =>
        `${getOptimizedCloudinaryImageUrl(url, { variant, width })} ${width}w`
    )
    .join(', ')
}
