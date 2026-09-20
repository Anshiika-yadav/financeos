import React, { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-hand action buttons */
  actions?: ReactNode;
  /** Optional breadcrumb or back-link */
  breadcrumb?: ReactNode;
}

export function PageHeader({ title, subtitle, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold text-ink-900 leading-tight tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[14px] text-ink-600 mt-1">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
