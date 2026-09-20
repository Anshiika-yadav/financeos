import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../services/api';
import { formatDateTime } from '../../utils/format';
import { clsx } from 'clsx';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorId: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface AuditTrailResponse {
  data: AuditEntry[];
}

interface AuditTrailTabProps {
  tenantId: string;
  resourceType: string;
  resourceId: string;
}

const ACTION_LABELS: Record<string, string> = {
  create:       'Created',
  update:       'Updated',
  submit:       'Submitted for approval',
  approve:      'Approved',
  reject:       'Rejected',
  post:         'Posted to GL',
  reverse:      'Reversed',
  lock_period:  'Period locked',
  login:        'Signed in',
  invite_user:  'User invited',
  export:       'Exported',
};

const ACTION_COLORS: Record<string, string> = {
  create:      'bg-info-bg text-info border-info-border',
  submit:      'bg-warning-bg text-warning border-warning-border',
  approve:     'bg-success-bg text-success border-success-border',
  post:        'bg-success-bg text-success border-success-border',
  reject:      'bg-danger-bg text-danger border-danger-border',
  reverse:     'bg-danger-bg text-danger border-danger-border',
  default:     'bg-surface-100 text-ink-600',
};

export function AuditTrailTab({ tenantId: _tenantId, resourceType, resourceId }: AuditTrailTabProps) {
  const { data, isLoading, isError } = useQuery<AuditTrailResponse>({
    queryKey: ['audit-trail', resourceType, resourceId],
    queryFn: () =>
      apiGet('/controls/audit-trail', {
        resourceType,
        resourceId,
        limit: 50,
      }),
    // Don't retry hard — audit trail is informational, not blocking
    retry: 1,
  });

  const entries = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-ink-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[13px]">Loading audit trail…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 py-8 text-ink-400 text-[13px]">
        <AlertCircle className="w-4 h-4 text-danger" />
        Could not load audit trail.
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-ink-400">
        <ShieldCheck className="w-8 h-8" />
        <p className="text-[13px]">No audit events recorded yet.</p>
      </div>
    );
  }

  return (
    <ol className="relative border-l-2 border-border ml-2 space-y-0">
      {entries.map((entry, idx) => {
        const actionKey = entry.action.toLowerCase().replace(/ /g, '_');
        const label = ACTION_LABELS[actionKey] ?? entry.action;
        const colorClass = ACTION_COLORS[actionKey] ?? ACTION_COLORS.default;

        return (
          <li key={entry.id} className="pl-5 pb-5 relative">
            {/* Dot */}
            <span
              className={clsx(
                'absolute -left-[9px] top-0.5 w-4 h-4 rounded-full border-2 border-surface-0',
                idx === 0 ? 'bg-gold-500' : 'bg-border-strong',
              )}
            />

            <div className="flex items-start justify-between gap-4">
              <div>
                <span className={clsx('status-chip border', colorClass, 'mb-1')}>
                  {label}
                </span>
                <p className="text-[12px] text-ink-400 mt-0.5">
                  {formatDateTime(entry.createdAt)}
                </p>
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <p className="text-[12px] text-ink-600 mt-1 font-mono bg-surface-50 px-2 py-1 rounded border border-border">
                    {JSON.stringify(entry.metadata)}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
