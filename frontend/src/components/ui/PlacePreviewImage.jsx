import { MapPinned } from 'lucide-react'

import { CloudinaryImage } from './CloudinaryImage'

export function PlacePreviewImage({
  src,
  alt,
  className = '',
  sizes = '(min-width: 1280px) 18vw, (min-width: 768px) 30vw, 50vw',
  fallbackIcon = MapPinned,
  imageClassName = 'h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]',
}) {
  const Icon = fallbackIcon

  return (
    <div className={`relative overflow-hidden bg-ink ${className}`}>
      {src ? (
        <CloudinaryImage
          src={src}
          alt={alt}
          variant="card"
          sizes={sizes}
          className={imageClassName}
          loading="lazy"
        />
      ) : (
        <div className="theme-brand-gradient flex h-full w-full items-center justify-center text-brand">
          <Icon className="h-10 w-10" />
        </div>
      )}
    </div>
  )
}
