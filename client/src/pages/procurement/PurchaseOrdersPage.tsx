import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { apiGet } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { RecordStatus } from '../../types';

interface PurchaseOrder {
  id: string; poNumber: string; title: string;
  orderDate: string; deliveryDate?: string;
  totalAmount: number; currency: string; status: string;
  lines: { id: string; description: string; quantity: number; unitPrice: number; received: number }[];
}

export function PurchaseOrdersPage() {
  const { data: pos = [], isLoading } = useQuery<PurchaseOrder[]>({ queryKey: ['purchase-orders'], queryFn: () => apiGet('/procurement/orders') });

  const columns: Column<PurchaseOrder>[] = [
    { key: 'poNumber', header: 'PO #', className: 'font-mono font-medium' },
    { key: 'title', header: 'Description', className: 'max-w-xs truncate' },
    { key: 'orderDate', header: 'Order Date', render: r => formatDate(r.orderDate) },
    { key: 'deliveryDate', header: 'Expected Delivery', render: r => r.deliveryDate ? formatDate(r.deliveryDate) : '—' },
    { key: 'totalAmount', header: 'Value', render: r => formatCurrency(r.totalAmount, r.currency), className: 'text-right font-medium' },
    { key: 'receipt', header: 'Receipt', render: r => {
      const totalOrdered = r.lines?.reduce((s, l) => s + l.quantity, 0) ?? 0;
      const totalReceived = r.lines?.reduce((s, l) => s + (l.received ?? 0), 0) ?? 0;
      const pct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
      return (
        <div className="flex items-center gap-2">
          <div className="w-20 bg-gray-200 rounded-full h-1.5"><div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} /></div>
          <span className="text-xs text-gray-500">{pct}%</span>
        </div>
      );
    }},
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status as RecordStatus} /> },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Purchase Orders" subtitle={`${pos.length} orders`} />
      <DataTable columns={columns} data={pos} keyField="id" isLoading={isLoading} />
    </div>
  );
}
