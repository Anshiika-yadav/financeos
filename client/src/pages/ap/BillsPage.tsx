import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Search, Send, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { Button } from '../../components/shared/Button';
import { Modal } from '../../components/shared/Modal';
import { Input } from '../../components/shared/Input';
import { Select } from '../../components/shared/Select';
import { KpiCard } from '../../components/shared/KpiCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { DetailDrawer } from '../../components/shared/DetailDrawer';
import { AuditTrailTab } from '../../components/shared/AuditTrailTab';
import { DocumentsTab } from '../../components/shared/DocumentsTab';
import { apiGet, apiPost, apiPatch } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuth } from '../../store/auth.context';
import { clsx } from 'clsx';
import { v4 as uuidv4 } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillLine {
  id: string; lineNumber: number; description: string;
  quantity: number; unitPrice: number; taxRate: number; amount: number;
}
interface Bill {
  id: string; billNumber: string; reference?: string;
  supplier: { name: string; code: string };
  billDate: string; dueDate: string;
  subtotal: number; taxAmount: number; totalAmount: number;
  amountPaid: number; status: string; currency: string;
  lines?: BillLine[];
}
interface Supplier { id: string; code: string; name: string; currency: string; }

const STATUS_FILTERS = ['', 'Draft', 'Pending', 'Approved', 'Paid'];
const CURRENCIES = [{ value: 'USD', label: 'USD — US Dollar' }, { value: 'AUD', label: 'AUD — Australian Dollar' }, { value: 'GBP', label: 'GBP — British Pound' }, { value: 'EUR', label: 'EUR — Euro' }];

// ─── Component ────────────────────────────────────────────────────────────────

export function BillsPage() {
  const { tenantContext } = useAuth() as any;
  const tenantId = tenantContext?.tenantId ?? '';
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]             = useState('');
  const [showCreate, setShowCreate]     = useState(false);
  const [selected, setSelected]         = useState<Bill | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: result, isLoading, isError } = useQuery<{ data: Bill[] }>({
    queryKey: ['ap-bills', statusFilter],
    queryFn: () => apiGet('/ap/bills', { ...(statusFilter ? { status: statusFilter } : {}), limit: 100 }),
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['ap-suppliers'],
    queryFn: () => apiGet('/ap/suppliers'),
  });

  const bills    = result?.data ?? [];
  const filtered = bills.filter((b) => {
    const q = search.toLowerCase();
    return !q || b.billNumber.toLowerCase().includes(q) || b.supplier?.name?.toLowerCase().includes(q);
  });

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const outstanding = bills.filter((b) => !['Paid','Cancelled'].includes(b.status))
    .reduce((s, b) => s + Number(b.totalAmount) - Number(b.amountPaid ?? 0), 0);
  const overdueCnt  = bills.filter((b) => new Date(b.dueDate) < new Date() && !['Paid','Cancelled'].includes(b.status)).length;
  const pendingCnt  = bills.filter((b) => b.status === 'Pending').length;

  // ── Mutations ───────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ap-bills'] });
    if (selected) qc.invalidateQueries({ queryKey: ['ap-bill', selected.id] });
  };
  const submitMutation  = useMutation({ mutationFn: (id: string) => apiPatch(`/ap/bills/${id}/submit`),  onSuccess: invalidate });
  const approveMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/ap/bills/${id}/approve`), onSuccess: invalidate });

  // ── Detail query ─────────────────────────────────────────────────────────────
  const { data: detailBill } = useQuery<Bill>({
    queryKey: ['ap-bill', selected?.id],
    queryFn: () => apiGet(`/ap/bills/${selected!.id}`),
    enabled: !!selected,
  });

  // ── Create form ──────────────────────────────────────────────────────────────
  const { register, handleSubmit, control, reset, watch } = useForm({
    defaultValues: {
      supplierId: '', reference: '', description: '',
      billDate: new Date().toISOString().split('T')[0], dueDate: '', currency: 'USD',
      lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const linesWatch = watch('lines');
  const subtotal   = linesWatch.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const taxTotal   = linesWatch.reduce((s, l) => {
    const amt = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
    return s + amt * (Number(l.taxRate) || 0) / 100;
  }, 0);

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiPost('/ap/bills', data, { 'Idempotency-Key': uuidv4() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ap-bills'] }); setShowCreate(false); reset(); },
  });

  // ── Columns ─────────────────────────────────────────────────────────────────
  const columns: Column<Bill>[] = [
    { key: 'billNumber', header: 'Bill #', className: 'w-36', render: (r) => <span className="font-mono text-[13px] font-medium">{r.billNumber}</span> },
    { key: 'supplier',   header: 'Supplier', render: (r) => r.supplier?.name ?? '—' },
    { key: 'reference',  header: 'Reference', render: (r) => r.reference ?? <span className="text-ink-300">—</span> },
    { key: 'billDate',   header: 'Bill Date',  render: (r) => formatDate(r.billDate) },
    {
      key: 'dueDate', header: 'Due Date',
      render: (r) => {
        const overdue = new Date(r.dueDate) < new Date() && !['Paid','Cancelled'].includes(r.status);
        return <span className={overdue ? 'text-danger font-medium' : ''}>{formatDate(r.dueDate)}</span>;
      },
    },
    { key: 'totalAmount', header: 'Total', tdClassName: 'num', render: (r) => formatCurrency(r.totalAmount, r.currency) },
    { key: 'status',      header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: '', className: 'w-24',
      render: (r) => (
        <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
          {r.status === 'Draft' && (
            <button onClick={() => submitMutation.mutate(r.id)} className="text-[11px] font-medium text-info hover:text-blue-800 flex items-center gap-1 transition-colors">
              <Send className="w-3 h-3" />Submit
            </button>
          )}
          {r.status === 'Pending' && (
            <button onClick={() => approveMutation.mutate(r.id)} className="text-[11px] font-medium text-success hover:text-green-800 flex items-center gap-1 transition-colors">
              <CheckCircle2 className="w-3 h-3" />Approve
            </button>
          )}
        </div>
      ),
    },
  ];

  if (isError) {
    return (
      <div className="page">
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <AlertCircle className="w-10 h-10 text-danger" />
          <p className="text-[15px] font-medium text-ink-700">Could not load bills</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Bills"
        subtitle="Accounts Payable"
        actions={
          <>
            <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Export</Button>
            <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreate(true)}>New Bill</Button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Bills"       value={bills.length} />
        <KpiCard label="Outstanding"       value={formatCurrency(outstanding)} accent="warning" />
        <KpiCard label="Pending Approval"  value={pendingCnt} accent={pendingCnt > 0 ? 'warning' : 'default'} />
        <KpiCard label="Overdue"           value={overdueCnt} accent={overdueCnt > 0 ? 'danger' : 'default'} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bills…" className="field-input pl-9" />
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`filter-chip ${statusFilter === s ? 'filter-chip--active' : ''}`}>{s || 'All'}</button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns} data={filtered} keyField="id"
        isLoading={isLoading} isError={isError}
        onRowClick={setSelected}
        emptyMessage="No bills found."
        emptyIcon={<FileText className="w-8 h-8" />}
      />

      {/* Detail drawer */}
      {selected && (
        <DetailDrawer
          title={detailBill?.billNumber ?? selected.billNumber}
          subtitle={detailBill?.supplier?.name ?? selected.supplier?.name}
          onClose={() => setSelected(null)}
          actions={
            <div className="flex gap-2">
              {(detailBill?.status ?? selected.status) === 'Draft' && (
                <Button size="sm" variant="secondary" isLoading={submitMutation.isPending} onClick={() => submitMutation.mutate(selected.id)}>Submit</Button>
              )}
              {(detailBill?.status ?? selected.status) === 'Pending' && (
                <Button size="sm" variant="gold" isLoading={approveMutation.isPending} onClick={() => approveMutation.mutate(selected.id)}>Approve</Button>
              )}
            </div>
          }
          tabs={[
            {
              id: 'details', label: 'Details',
              content: (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-[13px]">
                    {[
                      { label: 'Bill Number', value: detailBill?.billNumber ?? selected.billNumber },
                      { label: 'Supplier',    value: detailBill?.supplier?.name ?? selected.supplier?.name },
                      { label: 'Reference',   value: detailBill?.reference ?? selected.reference ?? '—' },
                      { label: 'Bill Date',   value: formatDate(detailBill?.billDate ?? selected.billDate) },
                      { label: 'Due Date',    value: formatDate(detailBill?.dueDate ?? selected.dueDate) },
                      { label: 'Status',      value: <StatusBadge status={detailBill?.status ?? selected.status} /> },
                      { label: 'Subtotal',    value: formatCurrency(detailBill?.subtotal ?? selected.subtotal) },
                      { label: 'Tax',         value: formatCurrency(detailBill?.taxAmount ?? selected.taxAmount ?? 0) },
                      { label: 'Total',       value: <span className="font-semibold">{formatCurrency(detailBill?.totalAmount ?? selected.totalAmount)}</span> },
                      { label: 'Amount Paid', value: formatCurrency(detailBill?.amountPaid ?? selected.amountPaid ?? 0) },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <span className="text-ink-600 text-[11px] uppercase tracking-wider">{label}</span>
                        <span className="text-ink-900 font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                  {/* Lines */}
                  {(detailBill?.lines ?? []).length > 0 && (
                    <div className="rounded-card border border-border overflow-hidden mt-2">
                      <table className="data-table">
                        <thead><tr>
                          <th>Description</th>
                          <th className="num w-16">Qty</th>
                          <th className="num w-28">Unit Price</th>
                          <th className="num w-20">Tax %</th>
                          <th className="num w-28">Amount</th>
                        </tr></thead>
                        <tbody>
                          {(detailBill?.lines ?? []).map((l) => (
                            <tr key={l.id}>
                              <td>{l.description}</td>
                              <td className="num">{l.quantity}</td>
                              <td className="num">{formatCurrency(l.unitPrice)}</td>
                              <td className="num">{l.taxRate}%</td>
                              <td className="num font-medium">{formatCurrency(l.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ),
            },
            { id: 'audit',     label: 'Audit Trail', content: <AuditTrailTab tenantId={tenantId} resourceType="bill" resourceId={selected.id} /> },
            { id: 'documents', label: 'Documents',   content: <DocumentsTab /> },
          ]}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal
          title="New Bill"
          subtitle="Captures a supplier bill. Lines are saved with taxes applied."
          size="xl"
          onClose={() => { setShowCreate(false); reset(); }}
          footer={
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-ink-600">
                Subtotal {formatCurrency(subtotal)} · Tax {formatCurrency(taxTotal)} · <strong>Total {formatCurrency(subtotal + taxTotal)}</strong>
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button>
                <Button form="create-bill-form" type="submit" isLoading={createMutation.isPending}>Save Bill</Button>
              </div>
            </div>
          }
        >
          <form id="create-bill-form" className="space-y-4" onSubmit={handleSubmit((d) => createMutation.mutate(d))} noValidate>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Supplier" required options={suppliers.map((s) => ({ value: s.id, label: s.name }))} placeholder="Select supplier…" {...register('supplierId')} />
              <Input label="Supplier Reference" placeholder="Their invoice number" {...register('reference')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Bill Date" type="date" required {...register('billDate')} />
              <Input label="Due Date"  type="date" required {...register('dueDate')} />
              <Select label="Currency" options={CURRENCIES} {...register('currency')} />
            </div>
            <Input label="Description" placeholder="Brief description of this bill" {...register('description')} />

            {/* Lines */}
            <div>
              <p className="field-label mb-2">Line Items</p>
              <div className="rounded-card border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead className="bg-surface-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-600">Description</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-600 w-16">Qty</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-600 w-28">Unit Price</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-600 w-20">Tax %</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fields.map((field, i) => (
                      <tr key={field.id}>
                        <td className="px-2 py-1.5"><input className="field-input text-[12px] py-1" placeholder="Description" {...register(`lines.${i}.description`)} /></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" step="1" className="field-input text-[12px] py-1 text-right" {...register(`lines.${i}.quantity`, { valueAsNumber: true })} /></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" className="field-input text-[12px] py-1 text-right" {...register(`lines.${i}.unitPrice`, { valueAsNumber: true })} /></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" max="100" step="0.1" className="field-input text-[12px] py-1 text-right" {...register(`lines.${i}.taxRate`, { valueAsNumber: true })} /></td>
                        <td className="px-2 py-1.5">
                          {fields.length > 1 && <button type="button" onClick={() => remove(i)} className="text-ink-400 hover:text-danger transition-colors text-[16px] leading-none">×</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 border-t border-border bg-surface-50">
                  <button type="button" onClick={() => append({ description: '', quantity: 1, unitPrice: 0, taxRate: 0 })} className="text-[12px] text-info hover:text-blue-800 font-medium transition-colors">+ Add line</button>
                </div>
              </div>
            </div>
            {createMutation.isError && (
              <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">Failed to save bill. Check all required fields.</p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
