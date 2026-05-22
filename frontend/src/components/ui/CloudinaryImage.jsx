import {
  getOptimizedCloudinaryImageUrl,
  getOptimizedCloudinarySrcSet,
} from '../../lib/cloudinary'

export function CloudinaryImage({
  src,
  alt,
  variant = 'card',
  sizes,
  className,
  loading = 'lazy',
  decoding = 'async',
  fetchPriority,
}) {
  if (!src) {
    return null
  }

  const optimizedSrc = getOptimizedCloudinaryImageUrl(src, { variant })
  const srcSet = getOptimizedCloudinarySrcSet(src, { variant })

  return (
    <img
      src={optimizedSrc}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
    />
  )
}
