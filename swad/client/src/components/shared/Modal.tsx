import React, { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_MAP: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ title, subtitle, onClose, children, footer, size = 'md' }: ModalProps) {
  // Close on Escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onClose]);

  // Trap body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy-950/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={clsx(
          'relative bg-surface-0 rounded-card2 shadow-modal w-full flex flex-col',
          'max-h-[90vh]',
          SIZE_MAP[size],
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 id="modal-title" className="text-[16px] font-semibold text-ink-900">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[13px] text-ink-600 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink-900 p-1 rounded transition-colors ml-4 flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-border bg-surface-50 flex-shrink-0 rounded-b-card2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
