import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Package, AlertCircle } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { Button } from '../../components/shared/Button';
import { KpiCard } from '../../components/shared/KpiCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { DetailDrawer } from '../../components/shared/DetailDrawer';
import { AuditTrailTab } from '../../components/shared/AuditTrailTab';
import { DocumentsTab } from '../../components/shared/DocumentsTab';
import { apiGet } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuth } from '../../store/auth.context';

interface PoLine { id: string; description: string; quantity: number; unitPrice: number; amount: number; received: number; }
interface PurchaseOrder { id: string; poNumber: string; title: string; orderDate: string; deliveryDate?: string; totalAmount: number; currency: string; status: string; lines?: PoLine[]; }

export function PurchaseOrdersPage() {
  const { tenantContext } = useAuth() as any;
  const tenantId = tenantContext?.tenantId ?? '';
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);

  const { data: pos = [], isLoading, isError } = useQuery<PurchaseOrder[]>({ queryKey: ['procurement-pos'], queryFn: () => apiGet('/procurement/orders') });

  const totalValue = pos.reduce((s, p) => s + Number(p.totalAmount), 0);

  const receiptPct = (po: PurchaseOrder) => {
    const lines = po.lines ?? [];
    const total    = lines.reduce((s, l) => s + l.quantity, 0);
    const received = lines.reduce((s, l) => s + (l.received ?? 0), 0);
    return total > 0 ? Math.min(Math.round((received / total) * 100), 100) : 0;
  };

  const columns: Column<PurchaseOrder>[] = [
    { key: 'poNumber',      header: 'PO #',          className: 'w-32', render: (r) => <span className="font-mono text-[13px] font-medium">{r.poNumber}</span> },
    { key: 'title',         header: 'Description',   className: 'max-w-xs truncate' },
    { key: 'orderDate',     header: 'Order Date',    render: (r) => formatDate(r.orderDate) },
    { key: 'deliveryDate',  header: 'Expected Delivery', render: (r) => r.deliveryDate ? formatDate(r.deliveryDate) : <span className="text-ink-300">—</span> },
    { key: 'totalAmount',   header: 'Value',         tdClassName: 'num font-medium', render: (r) => formatCurrency(r.totalAmount, r.currency) },
    { key: 'receipt',       header: 'Receipt',
      render: (r) => {
        const pct = receiptPct(r);
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="flex-1 bg-surface-100 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-success' : pct > 50 ? 'bg-gold-500' : 'bg-border-strong'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] text-ink-400 tabular-nums w-8 text-right">{pct}%</span>
          </div>
        );
      },
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  if (isError) return <div className="page"><div className="flex flex-col items-center justify-center py-24 gap-3"><AlertCircle className="w-10 h-10 text-danger" /><p className="text-[15px] font-medium text-ink-700">Could not load purchase orders</p></div></div>;

  return (
    <div className="page">
      <PageHeader title="Purchase Orders" subtitle={`${pos.length} orders`}
        actions={<Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Export</Button>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Orders"  value={pos.length} />
        <KpiCard label="Total Value"   value={formatCurrency(totalValue)} accent="gold" />
        <KpiCard label="Approved"      value={pos.filter((p) => p.status === 'Approved').length} accent="success" />
        <KpiCard label="Fully Received" value={pos.filter((p) => receiptPct(p) === 100).length} accent="success" />
      </div>
      <DataTable columns={columns} data={pos} keyField="id" isLoading={isLoading} isError={isError}
        onRowClick={setSelected} emptyMessage="No purchase orders." emptyIcon={<Package className="w-8 h-8" />} />

      {selected && (
        <DetailDrawer title={selected.poNumber} subtitle={selected.title} onClose={() => setSelected(null)}
          tabs={[
            { id: 'details', label: 'Details', content: (
              <div className="space-y-4">
                <dl>{[
                  { label: 'PO Number',   value: selected.poNumber },
                  { label: 'Order Date',  value: formatDate(selected.orderDate) },
                  { label: 'Delivery',    value: selected.deliveryDate ? formatDate(selected.deliveryDate) : '—' },
                  { label: 'Value',       value: formatCurrency(selected.totalAmount, selected.currency) },
                  { label: 'Status',      value: <StatusBadge status={selected.status} /> },
                ].map(({ label, value }) => <div key={label} className="flex justify-between py-2.5 border-b border-border last:border-0"><dt className="text-[13px] text-ink-600">{label}</dt><dd className="text-[13px] text-ink-900 font-medium">{value}</dd></div>)}</dl>
                {(selected.lines ?? []).length > 0 && (
                  <div className="rounded-card border border-border overflow-hidden">
                    <table className="data-table"><thead><tr>
                      <th>Description</th><th className="num w-16">Qty</th><th className="num w-28">Unit Price</th><th className="num w-20">Received</th>
                    </tr></thead>
                    <tbody>{(selected.lines ?? []).map((l) => (
                      <tr key={l.id}><td>{l.description}</td><td className="num">{l.quantity}</td><td className="num">{formatCurrency(l.unitPrice)}</td><td className="num">{l.received ?? 0}</td></tr>
                    ))}</tbody></table>
                  </div>
                )}
              </div>
            )},
            { id: 'audit', label: 'Audit Trail', content: <AuditTrailTab tenantId={tenantId} resourceType="purchase_request" resourceId={selected.id} /> },
            { id: 'documents', label: 'Documents', content: <DocumentsTab /> },
          ]}
        />
      )}
    </div>
  );
}
