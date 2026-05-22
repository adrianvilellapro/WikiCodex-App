import { forwardRef } from 'react'

import { cn } from '../../lib/cn'

export const TextField = forwardRef(function TextField(
  { label, hint, error, className, inputClassName, ...props },
  ref
) {
  return (
    <label
      className={cn(
        'flex flex-col gap-2 font-label text-sm text-ink-soft',
        className
      )}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">
        {label}
      </span>
      <input
        ref={ref}
        {...props}
        className={cn(
          'archive-input text-base',
          error && 'bg-danger/5 text-danger focus:bg-danger/5',
          inputClassName
        )}
      />
      {error ? (
        <span className="font-body text-sm text-danger">{error}</span>
      ) : hint ? (
        <span className="font-body text-sm text-ink-muted">{hint}</span>
      ) : null}
    </label>
  )
})
