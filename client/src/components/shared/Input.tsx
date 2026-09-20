import React, { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, required, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="field-label">
            {label}
            {required && <span className="text-danger ml-0.5" aria-hidden>*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          className={clsx(
            'field-input',
            error && 'field-input--error',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined
          }
          {...props}
        />
        {error && (
          <p id={`${inputId}-err`} className="text-[12px] text-danger" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-[12px] text-ink-600">
            {hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
