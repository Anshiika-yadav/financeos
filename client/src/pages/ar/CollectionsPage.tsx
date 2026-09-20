import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { KpiCard } from '../../components/shared/KpiCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { apiGet } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { clsx } from 'clsx';

interface AgeingLine {
  id: string; invoiceNumber: string;
  customer: { name: string; code: string };
  dueDate: string; totalAmount: number; amountPaid: number;
  outstanding: number; daysOverdue: number; bucket: string; currency: string; status: string;
}

const BUCKETS = ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days'];
const BUCKET_ACCENT: Record<string, string> = {
  'Current':    'text-success',
  '1-30 days':  'text-warning',
  '31-60 days': 'text-[#9A6700]',
  '61-90 days': 'text-danger',
  '90+ days':   'text-danger',
};
const BUCKET_CHIP: Record<string, string> = {
  'Current':    'bg-success-bg text-success border-success-border',
  '1-30 days':  'bg-warning-bg text-warning border-warning-border',
  '31-60 days': 'bg-warning-bg text-warning border-warning-border',
  '61-90 days': 'bg-danger-bg  text-danger  border-danger-border',
  '90+ days':   'bg-danger-bg  text-danger  border-danger-border',
};

export function CollectionsPage() {
  const { data: lines = [], isLoading, isError } = useQuery<AgeingLine[]>({
    queryKey: ['ar-ageing'],
    queryFn: () => apiGet('/ar/ageing'),
  });

  const totalOutstanding = lines.reduce((s, l) => s + l.outstanding, 0);
  const overdue = lines.filter((l) => l.daysOverdue > 0);
  const overdueValue = overdue.reduce((s, l) => s + l.outstanding, 0);

  const bucketTotals = BUCKETS.map((b) => ({
    bucket: b,
    count: lines.filter((l) => l.bucket === b).length,
    total: lines.filter((l) => l.bucket === b).reduce((s, l) => s + l.outstanding, 0),
  }));

  const columns: Column<AgeingLine>[] = [
    { key: 'invoiceNumber', header: 'Invoice #',   className: 'w-36', render: (r) => <span className="font-mono text-[13px] font-medium">{r.invoiceNumber}</span> },
    { key: 'customer',      header: 'Customer',    render: (r) => r.customer?.name ?? '—' },
    { key: 'dueDate',       header: 'Due Date',    render: (r) => formatDate(r.dueDate) },
    { key: 'daysOverdue',   header: 'Days Overdue',
      render: (r) => r.daysOverdue > 0
        ? <span className="font-medium text-danger">{r.daysOverdue}d</span>
        : <span className="text-success flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Current</span>
    },
    { key: 'outstanding',   header: 'Outstanding', tdClassName: 'num', render: (r) => <span className={r.daysOverdue > 0 ? 'font-semibold text-danger' : 'font-semibold'}>{formatCurrency(r.outstanding, r.currency)}</span> },
    { key: 'bucket',        header: 'Ageing',      render: (r) => <span className={clsx('status-chip border', BUCKET_CHIP[r.bucket] ?? 'bg-surface-100 text-ink-600')}>{r.bucket}</span> },
    { key: 'status',        header: 'Status',      render: (r) => <StatusBadge status={r.status} /> },
    { key: 'action', header: '', className: 'w-24',
      render: (r) => r.daysOverdue > 30 ? (
        <button className="text-[11px] font-medium text-danger hover:text-red-800 flex items-center gap-1 transition-colors">
          <AlertTriangle className="w-3 h-3" />Escalate
        </button>
      ) : null,
    },
  ];

  if (isError) return <div className="page"><div className="flex flex-col items-center justify-center py-24 gap-3"><AlertCircle className="w-10 h-10 text-danger" /><p className="text-[15px] font-medium text-ink-700">Could not load ageing report</p></div></div>;

  return (
    <div className="page">
      <PageHeader title="Collections" subtitle="AR Ageing & Overdue Tracking" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Outstanding Total" value={formatCurrency(totalOutstanding)} accent="info" />
        <KpiCard label="Overdue Balance"   value={formatCurrency(overdueValue)}    accent={overdueValue > 0 ? 'danger' : 'success'} />
        <KpiCard label="Overdue Invoices"  value={overdue.length}                  accent={overdue.length > 0 ? 'danger' : 'default'} />
        <KpiCard label="Current Invoices"  value={lines.filter((l) => l.bucket === 'Current').length} accent="success" />
      </div>

      {/* Bucket summary */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {bucketTotals.map(({ bucket, count, total }) => (
          <div key={bucket} className="stat-card">
            <p className={clsx('stat-card__label', BUCKET_ACCENT[bucket])}>{bucket}</p>
            <p className={clsx('stat-card__value', BUCKET_ACCENT[bucket])}>{formatCurrency(total)}</p>
            <p className="stat-card__sub">{count} invoice{count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={[...lines].sort((a, b) => b.daysOverdue - a.daysOverdue)}
        keyField="id"
        isLoading={isLoading}
        isError={isError}
        emptyMessage="No outstanding invoices — all caught up!"
        emptyIcon={<CheckCircle2 className="w-8 h-8 text-success" />}
      />
    </div>
  );
}
