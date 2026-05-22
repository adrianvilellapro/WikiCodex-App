import { Sword } from 'lucide-react'

import { CloudinaryImage } from './CloudinaryImage'

export function ObjectPreviewImage({
  src,
  alt,
  className = '',
  sizes = '(min-width: 1280px) 18vw, (min-width: 768px) 30vw, 50vw',
}) {
  return (
    <div className={`relative overflow-hidden bg-ink ${className}`}>
      {src ? (
        <CloudinaryImage
          src={src}
          alt={alt}
          variant="card"
          sizes={sizes}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
      ) : (
        <div className="theme-brand-gradient flex h-full w-full items-center justify-center text-brand">
          <Sword className="h-10 w-10" />
        </div>
      )}
    </div>
  )
}
