import * as React from 'react'
import { cn } from '../../lib/utils.js'

export const Input = React.forwardRef(function Input({ className, type, ...props }, ref) {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-9 w-full min-w-0 rounded-lg border border-edge bg-bg-raised px-3 py-2 text-xs text-text-primary shadow-sm outline-none transition-colors',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-xs file:font-medium',
        'placeholder:text-text-muted',
        'focus-visible:border-amber/50 focus-visible:ring-2 focus-visible:ring-amber/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
})
