import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Search, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
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
import { v4 as uuidv4 } from 'uuid';

interface InvoiceLine { id: string; lineNumber: number; description: string; quantity: number; unitPrice: number; taxRate: number; amount: number; }
interface Invoice {
  id: string; invoiceNumber: string; reference?: string; description?: string;
  customer: { name: string; code: string };
  invoiceDate: string; dueDate: string;
  subtotal: number; taxAmount: number; totalAmount: number;
  amountPaid: number; status: string; currency: string;
  lines?: InvoiceLine[];
}
interface Customer { id: string; code: string; name: string; }

const STATUS_FILTERS = ['', 'Draft', 'Pending', 'Approved', 'Posted', 'Paid'];
const CURRENCIES = [{ value: 'USD', label: 'USD' }, { value: 'AUD', label: 'AUD' }, { value: 'GBP', label: 'GBP' }, { value: 'EUR', label: 'EUR' }];

export function InvoicesPage() {
  const { tenantContext } = useAuth() as any;
  const tenantId = tenantContext?.tenantId ?? '';
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]             = useState('');
  const [showCreate, setShowCreate]     = useState(false);
  const [selected, setSelected]         = useState<Invoice | null>(null);

  const { data: result, isLoading, isError } = useQuery<{ data: Invoice[] }>({
    queryKey: ['ar-invoices', statusFilter],
    queryFn: () => apiGet('/ar/invoices', { ...(statusFilter ? { status: statusFilter } : {}), limit: 100 }),
  });
  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ['ar-customers'], queryFn: () => apiGet('/ar/customers') });
  const { data: detailInvoice } = useQuery<Invoice>({
    queryKey: ['ar-invoice', selected?.id],
    queryFn: () => apiGet(`/ar/invoices/${selected!.id}`),
    enabled: !!selected,
  });

  const invoices = result?.data ?? [];
  const filtered = invoices.filter((i) => {
    const q = search.toLowerCase();
    return !q || i.invoiceNumber.toLowerCase().includes(q) || i.customer?.name?.toLowerCase().includes(q);
  });

  const outstanding = invoices.filter((i) => !['Paid','Cancelled'].includes(i.status))
    .reduce((s, i) => s + Number(i.totalAmount) - Number(i.amountPaid ?? 0), 0);
  const overdueCnt  = invoices.filter((i) => new Date(i.dueDate) < new Date() && !['Paid','Cancelled'].includes(i.status)).length;
  const pendingCnt  = invoices.filter((i) => i.status === 'Pending').length;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ar-invoices'] });
    if (selected) qc.invalidateQueries({ queryKey: ['ar-invoice', selected.id] });
  };
  const approveMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/ar/invoices/${id}/approve`), onSuccess: invalidate });

  const { register, handleSubmit, control, reset, watch } = useForm({
    defaultValues: {
      customerId: '', reference: '', description: '',
      invoiceDate: new Date().toISOString().split('T')[0], dueDate: '', currency: 'USD',
      lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const linesWatch = watch('lines');
  const subtotal   = linesWatch.reduce((s, l) => s + (Number(l.quantity)||0) * (Number(l.unitPrice)||0), 0);
  const taxTotal   = linesWatch.reduce((s, l) => { const a = (Number(l.quantity)||0)*(Number(l.unitPrice)||0); return s + a*(Number(l.taxRate)||0)/100; }, 0);

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiPost('/ar/invoices', data, { 'Idempotency-Key': uuidv4() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ar-invoices'] }); setShowCreate(false); reset(); },
  });

  const columns: Column<Invoice>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', className: 'w-36', render: (r) => <span className="font-mono text-[13px] font-medium">{r.invoiceNumber}</span> },
    { key: 'customer',    header: 'Customer',   render: (r) => r.customer?.name ?? '—' },
    { key: 'invoiceDate', header: 'Issue Date',  render: (r) => formatDate(r.invoiceDate) },
    { key: 'dueDate',     header: 'Due Date',
      render: (r) => { const ov = new Date(r.dueDate) < new Date() && !['Paid','Cancelled'].includes(r.status); return <span className={ov ? 'text-danger font-medium' : ''}>{formatDate(r.dueDate)}</span>; }},
    { key: 'totalAmount', header: 'Total',      tdClassName: 'num', render: (r) => formatCurrency(r.totalAmount, r.currency) },
    { key: 'amountPaid',  header: 'Paid',       tdClassName: 'num', render: (r) => formatCurrency(r.amountPaid ?? 0, r.currency) },
    { key: 'status',      header: 'Status',     render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: '', className: 'w-24',
      render: (r) => r.status === 'Pending' ? (
        <div onClick={(e) => e.stopPropagation()}>
          <button onClick={() => approveMutation.mutate(r.id)} className="text-[11px] font-medium text-success hover:text-green-800 flex items-center gap-1 transition-colors">
            <CheckCircle2 className="w-3 h-3" />Approve
          </button>
        </div>
      ) : null,
    },
  ];

  if (isError) return <div className="page"><div className="flex flex-col items-center justify-center py-24 gap-3"><AlertCircle className="w-10 h-10 text-danger" /><p className="text-[15px] font-medium text-ink-700">Could not load invoices</p></div></div>;

  return (
    <div className="page">
      <PageHeader title="Sales Invoices" subtitle="Accounts Receivable"
        actions={<>
          <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Export</Button>
          <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreate(true)}>New Invoice</Button>
        </>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Invoices"    value={invoices.length} />
        <KpiCard label="Outstanding"       value={formatCurrency(outstanding)} accent="info" />
        <KpiCard label="Pending Approval"  value={pendingCnt}  accent={pendingCnt > 0 ? 'warning' : 'default'} />
        <KpiCard label="Overdue"           value={overdueCnt}  accent={overdueCnt > 0 ? 'danger' : 'default'} />
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices…" className="field-input pl-9" />
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`filter-chip ${statusFilter === s ? 'filter-chip--active' : ''}`}>{s || 'All'}</button>
          ))}
        </div>
      </div>
      <DataTable columns={columns} data={filtered} keyField="id" isLoading={isLoading} isError={isError}
        onRowClick={setSelected} emptyMessage="No invoices found." emptyIcon={<FileText className="w-8 h-8" />} />

      {selected && (
        <DetailDrawer
          title={detailInvoice?.invoiceNumber ?? selected.invoiceNumber}
          subtitle={detailInvoice?.customer?.name ?? selected.customer?.name}
          onClose={() => setSelected(null)}
          actions={
            <div className="flex gap-2">
              {(detailInvoice?.status ?? selected.status) === 'Pending' && (
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
                      { label: 'Invoice #',   value: detailInvoice?.invoiceNumber ?? selected.invoiceNumber },
                      { label: 'Customer',    value: detailInvoice?.customer?.name ?? selected.customer?.name },
                      { label: 'Issue Date',  value: formatDate(detailInvoice?.invoiceDate ?? selected.invoiceDate) },
                      { label: 'Due Date',    value: formatDate(detailInvoice?.dueDate ?? selected.dueDate) },
                      { label: 'Status',      value: <StatusBadge status={detailInvoice?.status ?? selected.status} /> },
                      { label: 'Total',       value: <span className="font-semibold">{formatCurrency(detailInvoice?.totalAmount ?? selected.totalAmount)}</span> },
                      { label: 'Paid',        value: formatCurrency(detailInvoice?.amountPaid ?? selected.amountPaid ?? 0) },
                      { label: 'Outstanding', value: <span className="font-semibold text-info">{formatCurrency((Number(detailInvoice?.totalAmount ?? selected.totalAmount)) - (Number(detailInvoice?.amountPaid ?? selected.amountPaid ?? 0)))}</span> },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <span className="text-ink-600 text-[11px] uppercase tracking-wider">{label}</span>
                        <span className="text-ink-900 font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                  {(detailInvoice?.lines ?? []).length > 0 && (
                    <div className="rounded-card border border-border overflow-hidden">
                      <table className="data-table"><thead><tr>
                        <th>Description</th><th className="num w-16">Qty</th><th className="num w-28">Price</th><th className="num w-20">Tax</th><th className="num w-28">Amount</th>
                      </tr></thead>
                      <tbody>{(detailInvoice?.lines ?? []).map((l) => (
                        <tr key={l.id}><td>{l.description}</td><td className="num">{l.quantity}</td><td className="num">{formatCurrency(l.unitPrice)}</td><td className="num">{l.taxRate}%</td><td className="num font-medium">{formatCurrency(l.amount)}</td></tr>
                      ))}</tbody></table>
                    </div>
                  )}
                </div>
              ),
            },
            { id: 'audit',     label: 'Audit Trail', content: <AuditTrailTab tenantId={tenantId} resourceType="invoice" resourceId={selected.id} /> },
            { id: 'documents', label: 'Documents',   content: <DocumentsTab /> },
          ]}
        />
      )}

      {showCreate && (
        <Modal title="New Invoice" size="xl" onClose={() => { setShowCreate(false); reset(); }}
          footer={
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-ink-600">Subtotal {formatCurrency(subtotal)} · Tax {formatCurrency(taxTotal)} · <strong>Total {formatCurrency(subtotal + taxTotal)}</strong></span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button>
                <Button form="create-invoice-form" type="submit" isLoading={createMutation.isPending}>Save Invoice</Button>
              </div>
            </div>
          }
        >
          <form id="create-invoice-form" className="space-y-4" onSubmit={handleSubmit((d) => createMutation.mutate(d))} noValidate>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Customer" required options={customers.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select customer…" {...register('customerId')} />
              <Input label="Reference" {...register('reference')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Invoice Date" type="date" required {...register('invoiceDate')} />
              <Input label="Due Date"     type="date" required {...register('dueDate')} />
              <Select label="Currency" options={CURRENCIES} {...register('currency')} />
            </div>
            <Input label="Description" {...register('description')} />
            <div>
              <p className="field-label mb-2">Line Items</p>
              <div className="rounded-card border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead className="bg-surface-50"><tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-600">Description</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-600 w-16">Qty</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-600 w-28">Price</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-600 w-20">Tax %</th>
                    <th className="w-8" />
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {fields.map((field, i) => (
                      <tr key={field.id}>
                        <td className="px-2 py-1.5"><input className="field-input text-[12px] py-1" {...register(`lines.${i}.description`)} /></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" step="1"    className="field-input text-[12px] py-1 text-right" {...register(`lines.${i}.quantity`,  { valueAsNumber: true })} /></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" className="field-input text-[12px] py-1 text-right" {...register(`lines.${i}.unitPrice`, { valueAsNumber: true })} /></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" max="100"   className="field-input text-[12px] py-1 text-right" {...register(`lines.${i}.taxRate`,   { valueAsNumber: true })} /></td>
                        <td className="px-2 py-1.5">{fields.length > 1 && <button type="button" onClick={() => remove(i)} className="text-ink-400 hover:text-danger transition-colors text-[16px] leading-none">×</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 border-t border-border bg-surface-50">
                  <button type="button" onClick={() => append({ description: '', quantity: 1, unitPrice: 0, taxRate: 0 })} className="text-[12px] text-info hover:text-blue-800 font-medium transition-colors">+ Add line</button>
                </div>
              </div>
            </div>
            {createMutation.isError && <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">Failed to save invoice.</p>}
          </form>
        </Modal>
      )}
    </div>
  );
}
