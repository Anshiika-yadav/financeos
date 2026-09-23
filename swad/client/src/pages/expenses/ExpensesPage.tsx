import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Search, Send, CheckCircle2, Receipt, AlertCircle } from 'lucide-react';
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

interface ExpenseLine { id: string; category: string; description: string; expenseDate: string; amount: number; currency: string; }
interface ExpenseClaim { id: string; claimNumber: string; description: string; claimDate: string; totalAmount: number; currency: string; status: string; lines?: ExpenseLine[]; }

const CATEGORIES = ['Travel', 'Accommodation', 'Meals', 'Conference', 'Office Supplies', 'Software', 'Training', 'Other'];
const STATUS_FILTERS = ['', 'Draft', 'Pending', 'Approved'];

export function ExpensesPage() {
  const { tenantContext } = useAuth() as any;
  const tenantId = tenantContext?.tenantId ?? '';
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]             = useState('');
  const [showCreate, setShowCreate]     = useState(false);
  const [selected, setSelected]         = useState<ExpenseClaim | null>(null);

  const { data: claims = [], isLoading, isError } = useQuery<ExpenseClaim[]>({ queryKey: ['expenses-claims'], queryFn: () => apiGet('/expenses/claims') });
  const filtered = claims.filter((c) => {
    const matchS = !statusFilter || c.status === statusFilter;
    const q = search.toLowerCase();
    const matchQ = !q || c.claimNumber.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    return matchS && matchQ;
  });

  const totalPending = claims.filter((c) => c.status === 'Pending').reduce((s, c) => s + c.totalAmount, 0);
  const invalidate   = () => qc.invalidateQueries({ queryKey: ['expenses-claims'] });
  const submitMutation  = useMutation({ mutationFn: (id: string) => apiPatch(`/expenses/claims/${id}/submit`),  onSuccess: invalidate });
  const approveMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/expenses/claims/${id}/approve`), onSuccess: invalidate });

  const { register, handleSubmit, control, reset, watch } = useForm({
    defaultValues: {
      description: '', claimDate: new Date().toISOString().split('T')[0], currency: 'USD',
      lines: [{ category: 'Travel', description: '', expenseDate: new Date().toISOString().split('T')[0], amount: 0, currency: 'USD' }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const linesWatch = watch('lines');
  const total = linesWatch.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const createMutation = useMutation({
    mutationFn: (d: unknown) => apiPost('/expenses/claims', d, { 'Idempotency-Key': uuidv4() }),
    onSuccess: () => { invalidate(); setShowCreate(false); reset(); },
  });

  const columns: Column<ExpenseClaim>[] = [
    { key: 'claimNumber',  header: 'Claim #',  className: 'w-36', render: (r) => <span className="font-mono text-[13px] font-medium">{r.claimNumber}</span> },
    { key: 'description',  header: 'Description' },
    { key: 'claimDate',    header: 'Date',        render: (r) => formatDate(r.claimDate) },
    { key: 'totalAmount',  header: 'Total',       tdClassName: 'num', render: (r) => formatCurrency(r.totalAmount, r.currency) },
    { key: 'status',       header: 'Status',      render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: '', className: 'w-24',
      render: (r) => (
        <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
          {r.status === 'Draft'   && <button onClick={() => submitMutation.mutate(r.id)}  className="text-[11px] font-medium text-info hover:text-blue-800 flex items-center gap-1 transition-colors"><Send className="w-3 h-3" />Submit</button>}
          {r.status === 'Pending' && <button onClick={() => approveMutation.mutate(r.id)} className="text-[11px] font-medium text-success hover:text-green-800 flex items-center gap-1 transition-colors"><CheckCircle2 className="w-3 h-3" />Approve</button>}
        </div>
      ),
    },
  ];

  if (isError) return <div className="page"><div className="flex flex-col items-center justify-center py-24 gap-3"><AlertCircle className="w-10 h-10 text-danger" /><p className="text-[15px] font-medium text-ink-700">Could not load expense claims</p></div></div>;

  return (
    <div className="page">
      <PageHeader title="Expense Management" subtitle="Claims & reimbursements"
        actions={<><Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Export</Button><Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreate(true)}>New Claim</Button></>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Claims"     value={claims.length} />
        <KpiCard label="Pending Value"    value={formatCurrency(totalPending)} accent={totalPending > 0 ? 'warning' : 'default'} />
        <KpiCard label="Pending Approval" value={claims.filter((c) => c.status === 'Pending').length} accent={claims.filter((c) => c.status === 'Pending').length > 0 ? 'warning' : 'default'} />
        <KpiCard label="Approved"         value={claims.filter((c) => c.status === 'Approved').length} accent="success" />
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search claims…" className="field-input pl-9" /></div>
        <div className="flex items-center gap-1.5">{STATUS_FILTERS.map((s) => <button key={s} onClick={() => setStatusFilter(s)} className={`filter-chip ${statusFilter === s ? 'filter-chip--active' : ''}`}>{s || 'All'}</button>)}</div>
      </div>
      <DataTable columns={columns} data={filtered} keyField="id" isLoading={isLoading} isError={isError} onRowClick={setSelected} emptyMessage="No expense claims." emptyIcon={<Receipt className="w-8 h-8" />} />

      {selected && (
        <DetailDrawer title={selected.claimNumber} subtitle={selected.description} onClose={() => setSelected(null)}
          actions={<div className="flex gap-2">
            {selected.status === 'Draft'   && <Button size="sm" variant="secondary" isLoading={submitMutation.isPending}  onClick={() => submitMutation.mutate(selected.id)}>Submit</Button>}
            {selected.status === 'Pending' && <Button size="sm" variant="gold"      isLoading={approveMutation.isPending} onClick={() => approveMutation.mutate(selected.id)}>Approve</Button>}
          </div>}
          tabs={[
            { id: 'details', label: 'Details', content: (
              <div className="space-y-4">
                <dl>{[
                  { label: 'Claim #',    value: selected.claimNumber },
                  { label: 'Date',       value: formatDate(selected.claimDate) },
                  { label: 'Total',      value: <span className="font-semibold">{formatCurrency(selected.totalAmount, selected.currency)}</span> },
                  { label: 'Status',     value: <StatusBadge status={selected.status} /> },
                ].map(({ label, value }) => <div key={label} className="flex justify-between py-2.5 border-b border-border last:border-0"><dt className="text-[13px] text-ink-600">{label}</dt><dd className="text-[13px] text-ink-900 font-medium">{value}</dd></div>)}</dl>
                {(selected.lines ?? []).length > 0 && (
                  <div className="rounded-card border border-border overflow-hidden">
                    <table className="data-table"><thead><tr><th>Category</th><th>Description</th><th>Date</th><th className="num">Amount</th></tr></thead>
                    <tbody>{(selected.lines ?? []).map((l) => <tr key={l.id}><td><span className="status-chip bg-surface-100 text-ink-600">{l.category}</span></td><td>{l.description}</td><td>{formatDate(l.expenseDate)}</td><td className="num font-medium">{formatCurrency(l.amount, l.currency)}</td></tr>)}</tbody></table>
                  </div>
                )}
              </div>
            )},
            { id: 'audit', label: 'Audit Trail', content: <AuditTrailTab tenantId={tenantId} resourceType="expense" resourceId={selected.id} /> },
            { id: 'documents', label: 'Documents', content: <DocumentsTab /> },
          ]}
        />
      )}

      {showCreate && (
        <Modal title="New Expense Claim" size="lg" onClose={() => { setShowCreate(false); reset(); }}
          footer={<div className="flex items-center justify-between"><span className="text-[12px] text-ink-600">Total: <strong>{formatCurrency(total)}</strong></span><div className="flex gap-2"><Button variant="secondary" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button><Button form="create-expense-form" type="submit" isLoading={createMutation.isPending}>Save Claim</Button></div></div>}
        >
          <form id="create-expense-form" className="space-y-4" onSubmit={handleSubmit((d) => createMutation.mutate(d))} noValidate>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Description" required {...register('description')} />
              <Input label="Claim Date"  type="date" required {...register('claimDate')} />
            </div>
            <div>
              <p className="field-label mb-2">Expense Lines</p>
              <div className="rounded-card border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead className="bg-surface-50"><tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-600 w-32">Category</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-600">Description</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-600 w-28">Date</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-600 w-28">Amount</th>
                    <th className="w-8" />
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {fields.map((field, i) => (
                      <tr key={field.id}>
                        <td className="px-2 py-1.5"><select className="field-input text-[12px] py-1" {...register(`lines.${i}.category`)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></td>
                        <td className="px-2 py-1.5"><input className="field-input text-[12px] py-1" placeholder="What was this for?" {...register(`lines.${i}.description`)} /></td>
                        <td className="px-2 py-1.5"><input type="date" className="field-input text-[12px] py-1" {...register(`lines.${i}.expenseDate`)} /></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" className="field-input text-[12px] py-1 text-right" {...register(`lines.${i}.amount`, { valueAsNumber: true })} /></td>
                        <td className="px-2 py-1.5">{fields.length > 1 && <button type="button" onClick={() => remove(i)} className="text-ink-400 hover:text-danger transition-colors text-[16px] leading-none">×</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 border-t border-border bg-surface-50">
                  <button type="button" onClick={() => append({ category: 'Travel', description: '', expenseDate: new Date().toISOString().split('T')[0], amount: 0, currency: 'USD' })} className="text-[12px] text-info hover:text-blue-800 font-medium transition-colors">+ Add expense</button>
                </div>
              </div>
            </div>
            {createMutation.isError && <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">Failed to save claim.</p>}
          </form>
        </Modal>
      )}
    </div>
  );
}
