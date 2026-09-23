import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Search, CheckCircle2, Send, ShoppingCart, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { Button } from '../../components/shared/Button';
import { Modal } from '../../components/shared/Modal';
import { Input } from '../../components/shared/Input';
import { KpiCard } from '../../components/shared/KpiCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { DetailDrawer } from '../../components/shared/DetailDrawer';
import { AuditTrailTab } from '../../components/shared/AuditTrailTab';
import { DocumentsTab } from '../../components/shared/DocumentsTab';
import { apiGet, apiPost, apiPatch } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuth } from '../../store/auth.context';
import { v4 as uuidv4 } from 'uuid';

interface PurchaseRequest { id: string; prNumber: string; title: string; department?: string; totalAmount: number; currency: string; status: string; requiredBy?: string; notes?: string; }

const STATUS_FILTERS = ['', 'Draft', 'Pending', 'Approved'];

export function PurchaseRequestsPage() {
  const { tenantContext } = useAuth() as any;
  const tenantId = tenantContext?.tenantId ?? '';
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]             = useState('');
  const [showCreate, setShowCreate]     = useState(false);
  const [selected, setSelected]         = useState<PurchaseRequest | null>(null);

  const { data: prs = [], isLoading, isError } = useQuery<PurchaseRequest[]>({ queryKey: ['procurement-prs', statusFilter], queryFn: () => apiGet('/procurement/requests') });
  const filtered = prs.filter((p) => {
    const q = search.toLowerCase();
    const matchStatus = !statusFilter || p.status === statusFilter;
    const matchQ = !q || p.title.toLowerCase().includes(q) || p.prNumber.toLowerCase().includes(q);
    return matchStatus && matchQ;
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['procurement-prs'] });
  const submitMutation  = useMutation({ mutationFn: (id: string) => apiPatch(`/procurement/requests/${id}/submit`),  onSuccess: invalidate });
  const approveMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/procurement/requests/${id}/approve`), onSuccess: invalidate });

  const { register, handleSubmit, reset } = useForm({ defaultValues: { title: '', department: '', totalAmount: 0, currency: 'USD', requiredBy: '', notes: '' } });
  const createMutation = useMutation({
    mutationFn: (d: unknown) => apiPost('/procurement/requests', d, { 'Idempotency-Key': uuidv4() }),
    onSuccess: () => { invalidate(); setShowCreate(false); reset(); },
  });

  const columns: Column<PurchaseRequest>[] = [
    { key: 'prNumber',    header: 'PR #',        className: 'w-32', render: (r) => <span className="font-mono text-[13px] font-medium">{r.prNumber}</span> },
    { key: 'title',       header: 'Title' },
    { key: 'department',  header: 'Department',  render: (r) => r.department ?? <span className="text-ink-300">—</span> },
    { key: 'totalAmount', header: 'Est. Value',  tdClassName: 'num', render: (r) => formatCurrency(r.totalAmount, r.currency) },
    { key: 'requiredBy',  header: 'Required By', render: (r) => r.requiredBy ? formatDate(r.requiredBy) : <span className="text-ink-300">—</span> },
    { key: 'status',      header: 'Status',      render: (r) => <StatusBadge status={r.status} /> },
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

  if (isError) return <div className="page"><div className="flex flex-col items-center justify-center py-24 gap-3"><AlertCircle className="w-10 h-10 text-danger" /><p className="text-[15px] font-medium text-ink-700">Could not load purchase requests</p></div></div>;

  return (
    <div className="page">
      <PageHeader title="Purchase Requests" subtitle="Procurement & Spend"
        actions={<><Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Export</Button><Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreate(true)}>New Request</Button></>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total"    value={prs.length} />
        <KpiCard label="Draft"    value={prs.filter((p) => p.status === 'Draft').length}    accent="default" />
        <KpiCard label="Pending"  value={prs.filter((p) => p.status === 'Pending').length}  accent={prs.filter((p) => p.status === 'Pending').length > 0 ? 'warning' : 'default'} />
        <KpiCard label="Approved" value={prs.filter((p) => p.status === 'Approved').length} accent="success" />
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests…" className="field-input pl-9" /></div>
        <div className="flex items-center gap-1.5">{STATUS_FILTERS.map((s) => <button key={s} onClick={() => setStatusFilter(s)} className={`filter-chip ${statusFilter === s ? 'filter-chip--active' : ''}`}>{s || 'All'}</button>)}</div>
      </div>
      <DataTable columns={columns} data={filtered} keyField="id" isLoading={isLoading} isError={isError} onRowClick={setSelected} emptyMessage="No purchase requests." emptyIcon={<ShoppingCart className="w-8 h-8" />} />

      {selected && (
        <DetailDrawer title={selected.prNumber} subtitle={selected.title} onClose={() => setSelected(null)}
          actions={<div className="flex gap-2">
            {selected.status === 'Draft'   && <Button size="sm" variant="secondary" isLoading={submitMutation.isPending}  onClick={() => submitMutation.mutate(selected.id)}>Submit</Button>}
            {selected.status === 'Pending' && <Button size="sm" variant="gold"      isLoading={approveMutation.isPending} onClick={() => approveMutation.mutate(selected.id)}>Approve</Button>}
          </div>}
          tabs={[
            { id: 'details', label: 'Details', content: (
              <dl>{[
                { label: 'PR Number',    value: selected.prNumber },
                { label: 'Title',        value: selected.title },
                { label: 'Department',   value: selected.department ?? '—' },
                { label: 'Value',        value: formatCurrency(selected.totalAmount, selected.currency) },
                { label: 'Required By',  value: selected.requiredBy ? formatDate(selected.requiredBy) : '—' },
                { label: 'Status',       value: <StatusBadge status={selected.status} /> },
                { label: 'Notes',        value: selected.notes ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2.5 border-b border-border last:border-0"><dt className="text-[13px] text-ink-600">{label}</dt><dd className="text-[13px] text-ink-900 font-medium">{value}</dd></div>
              ))}</dl>
            )},
            { id: 'audit', label: 'Audit Trail', content: <AuditTrailTab tenantId={tenantId} resourceType="purchase_request" resourceId={selected.id} /> },
            { id: 'documents', label: 'Documents', content: <DocumentsTab /> },
          ]}
        />
      )}

      {showCreate && (
        <Modal title="New Purchase Request" onClose={() => { setShowCreate(false); reset(); }}
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button><Button form="create-pr-form" type="submit" isLoading={createMutation.isPending}>Submit Request</Button></div>}
        >
          <form id="create-pr-form" className="space-y-4" onSubmit={handleSubmit((d) => createMutation.mutate(d))} noValidate>
            <Input label="Title / Description" required {...register('title')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Department"   {...register('department')} />
              <Input label="Required By" type="date" {...register('requiredBy')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Estimated Amount" type="number" min="0" step="0.01" {...register('totalAmount', { valueAsNumber: true })} />
              <Input label="Notes" {...register('notes')} />
            </div>
            {createMutation.isError && <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">Failed to create request.</p>}
          </form>
        </Modal>
      )}
    </div>
  );
}
