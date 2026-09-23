import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { apiGet } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';

interface AgeingLine {
  id: string; invoiceNumber: string;
  customer: { name: string }; dueDate: string;
  totalAmount: number; outstanding: number; daysOverdue: number; bucket: string; currency: string;
}

const BUCKET_COLORS: Record<string, string> = {
  Current: 'bg-green-100 text-green-800',
  '1-30 days': 'bg-yellow-100 text-yellow-800',
  '31-60 days': 'bg-orange-100 text-orange-800',
  '61-90 days': 'bg-red-100 text-red-700',
  '90+ days': 'bg-red-200 text-red-900',
};

export function CollectionsPage() {
  const { data: lines = [], isLoading } = useQuery<AgeingLine[]>({ queryKey: ['ar-ageing'], queryFn: () => apiGet('/ar/ageing') });

  const buckets = ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days'];
  const bucketTotals = buckets.map(b => ({ bucket: b, total: lines.filter(l => l.bucket === b).reduce((s, l) => s + l.outstanding, 0), count: lines.filter(l => l.bucket === b).length }));

  const columns: Column<AgeingLine>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', className: 'font-mono font-medium' },
    { key: 'customer', header: 'Customer', render: r => r.customer?.name },
    { key: 'dueDate', header: 'Due Date', render: r => formatDate(r.dueDate) },
    { key: 'daysOverdue', header: 'Days Overdue', render: r => <span className={r.daysOverdue > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>{r.daysOverdue > 0 ? `${r.daysOverdue}d overdue` : 'Current'}</span> },
    { key: 'outstanding', header: 'Outstanding', render: r => formatCurrency(r.outstanding, r.currency), className: 'text-right font-medium' },
    { key: 'bucket', header: 'Ageing Bucket', render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BUCKET_COLORS[r.bucket] ?? ''}`}>{r.bucket}</span> },
    { key: 'actions', header: '', render: r => r.daysOverdue > 30 ? (
      <button className="text-xs text-red-600 hover:underline flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Escalate</button>
    ) : null },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Collections" subtitle="AR Ageing & Overdue" />

      <div className="grid grid-cols-5 gap-3 mb-6">
        {bucketTotals.map(b => (
          <div key={b.bucket} className={`rounded-lg p-3 border ${b.bucket === 'Current' ? 'border-green-200 bg-green-50' : b.total > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
            <p className="text-xs font-medium text-gray-600">{b.bucket}</p>
            <p className={`text-xl font-bold mt-1 ${b.bucket === 'Current' ? 'text-green-700' : b.total > 0 ? 'text-red-700' : 'text-gray-400'}`}>{formatCurrency(b.total)}</p>
            <p className="text-xs text-gray-400">{b.count} invoices</p>
          </div>
        ))}
      </div>

      <DataTable columns={columns} data={lines.sort((a, b) => b.daysOverdue - a.daysOverdue)} keyField="id" isLoading={isLoading} emptyMessage="No outstanding invoices" />
    </div>
  );
}
