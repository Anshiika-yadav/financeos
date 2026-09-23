import React from 'react';
import { clsx } from 'clsx';

// Must match the RecordStatus enum in src/types/index.ts
export type BadgeStatus =
  | 'Draft'
  | 'Pending'
  | 'Approved'
  | 'Posted'
  | 'Partially Paid'
  | 'Paid'
  | 'Rejected'
  | 'Cancelled'
  | 'Closed'
  | 'Exception'
  | 'Open'
  | 'Locked'
  | 'Active'
  | 'Inactive';

interface Cfg { label: string; classes: string }

const STATUS_MAP: Record<BadgeStatus, Cfg> = {
  Draft:          { label: 'Draft',         classes: 'bg-surface-100 text-ink-600' },
  Pending:        { label: 'Pending',       classes: 'bg-warning-bg text-warning border border-warning-border' },
  Approved:       { label: 'Approved',      classes: 'bg-info-bg text-info border border-info-border' },
  Posted:         { label: 'Posted',        classes: 'bg-success-bg text-success border border-success-border' },
  'Partially Paid':{ label: 'Partial',      classes: 'bg-gold-50 text-gold-600 border border-gold-400' },
  Paid:           { label: 'Paid',          classes: 'bg-success-bg text-success border border-success-border' },
  Rejected:       { label: 'Rejected',      classes: 'bg-danger-bg text-danger border border-danger-border' },
  Cancelled:      { label: 'Cancelled',     classes: 'bg-surface-100 text-ink-400' },
  Closed:         { label: 'Closed',        classes: 'bg-surface-100 text-ink-600' },
  Exception:      { label: 'Exception',     classes: 'bg-danger-bg text-danger border border-danger-border' },
  Open:           { label: 'Open',          classes: 'bg-success-bg text-success border border-success-border' },
  Locked:         { label: 'Locked',        classes: 'bg-surface-100 text-ink-600' },
  Active:         { label: 'Active',        classes: 'bg-success-bg text-success border border-success-border' },
  Inactive:       { label: 'Inactive',      classes: 'bg-surface-100 text-ink-400' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg: Cfg = STATUS_MAP[status as BadgeStatus] ?? {
    label: status,
    classes: 'bg-surface-100 text-ink-600',
  };

  return (
    <span className={clsx('status-chip', cfg.classes, className)}>
      {cfg.label}
    </span>
  );
}
