import React, { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-input transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-1 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap';

  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary:
      'bg-navy-950 text-white hover:bg-navy-900 active:bg-navy-950',
    secondary:
      'bg-surface-0 text-ink-900 border border-border hover:bg-surface-50 hover:border-border-strong',
    danger:
      'bg-danger text-white hover:bg-red-800 active:bg-danger',
    ghost:
      'text-ink-700 hover:bg-surface-100 hover:text-ink-900',
    gold:
      'bg-gold-500 text-navy-950 font-semibold hover:bg-gold-600 active:bg-gold-600',
  };

  const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'px-3 py-1.5 text-[12px] gap-1.5',
    md: 'px-4 py-2 text-[13px] gap-2',
    lg: 'px-5 py-2.5 text-[14px] gap-2',
  };

  return (
    <button
      className={clsx(base, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" aria-hidden />
      ) : leftIcon ? (
        <span className="flex-shrink-0" aria-hidden>{leftIcon}</span>
      ) : null}
      {children}
    </button>
  );
}
