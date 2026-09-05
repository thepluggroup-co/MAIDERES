import React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: React.ReactNode
}

const base =
  'inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-[#F2A93B] hover:bg-[#E09A2E] active:bg-[#C98620] text-[#4A2F06] focus:ring-[#F2A93B]',
  secondary:
    'bg-white border border-[#254C8C] hover:bg-[#E4EAF4] active:bg-[#D3DEF0] text-[#254C8C] focus:ring-[#254C8C]',
  danger:
    'bg-[#A32D2D] hover:bg-[#8A2424] active:bg-[#711D1D] text-white focus:ring-[#A32D2D]',
  ghost:
    'bg-transparent hover:bg-[#F1EEE9] active:bg-[#E5E0D8] text-[#5F5E5A] focus:ring-[#5F5E5A]',
}

const sizes: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs gap-1 h-7',
  sm: 'px-3 py-1.5 text-sm gap-1.5 h-8',
  md: 'px-4 py-2 text-sm gap-2 h-10',
  lg: 'px-6 py-2.5 text-base gap-2 h-12',
}

const Spinner = ({ size }: { size: ButtonSize }) => (
  <svg
    className={clsx('animate-spin shrink-0', {
      'h-3 w-3': size === 'xs',
      'h-3.5 w-3.5': size === 'sm',
      'h-4 w-4': size === 'md',
      'h-5 w-5': size === 'lg',
    })}
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
)

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={twMerge(clsx(base, variants[variant], sizes[size], className))}
      {...props}
    >
      {loading && <Spinner size={size} />}
      {children}
    </button>
  ),
)

Button.displayName = 'Button'
