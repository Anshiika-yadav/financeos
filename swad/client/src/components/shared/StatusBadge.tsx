import React from 'react';
import { clsx } from 'clsx';
import { RecordStatus } from '../../types';

const statusConfig: Record<RecordStatus, { label: string; classes: string }> = {
  Draft: { label: 'Draft', classes: 'bg-gray-100 text-gray-700' },
  Pending: { label: 'Pending', classes: 'bg-yellow-100 text-yellow-800' },
  Approved: { label: 'Approved', classes: 'bg-blue-100 text-blue-800' },
  Posted: { label: 'Posted', classes: 'bg-green-100 text-green-800' },
  'Partially Paid': { label: 'Partial', classes: 'bg-purple-100 text-purple-800' },
  Paid: { label: 'Paid', classes: 'bg-green-200 text-green-900' },
  Rejected: { label: 'Rejected', classes: 'bg-red-100 text-red-800' },
  Cancelled: { label: 'Cancelled', classes: 'bg-gray-200 text-gray-600' },
  Closed: { label: 'Closed', classes: 'bg-gray-300 text-gray-700' },
  Exception: { label: 'Exception', classes: 'bg-orange-100 text-orange-800' },
};

interface StatusBadgeProps {
  status: RecordStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = statusConfig[status] ?? { label: status, classes: 'bg-gray-100 text-gray-700' };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        cfg.classes,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
