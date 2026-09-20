import React, { SelectHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className, id, required, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="field-label">
            {label}
            {required && <span className="text-danger ml-0.5" aria-hidden>*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          required={required}
          className={clsx(
            'field-input appearance-none',
            error && 'field-input--error',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${selectId}-err` : hint ? `${selectId}-hint` : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={`${selectId}-err`} className="text-[12px] text-danger" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${selectId}-hint`} className="text-[12px] text-ink-600">
            {hint}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';
