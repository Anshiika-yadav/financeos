import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, CheckCircle2, CreditCard, AlertCircle } from 'lucide-react';
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

interface PaymentRun {
  id: string; runNumber: string; description?: string;
  paymentDate: string; totalAmount: number; currency: string;
  status: string; approvedBy?: string; approvedAt?: string;
  billIds: string[];
}
interface Bill { id: string; billNumber: string; supplier: { name: string }; totalAmount: number; amountPaid: number; dueDate: string; status: string; }

export function PaymentRunsPage() {
  const { tenantContext } = useAuth() as any;
  const tenantId = tenantContext?.tenantId ?? '';
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected]     = useState<PaymentRun | null>(null);
  const [selectedBills, setSelectedBills] = useState<string[]>([]);

  const { data: runs = [], isLoading, isError } = useQuery<PaymentRun[]>({
    queryKey: ['ap-payment-runs'],
    queryFn: () => apiGet('/ap/payment-runs'),
  });
  const { data: approvedBillsResult } = useQuery<{ data: Bill[] }>({
    queryKey: ['ap-bills-approved'],
    queryFn: () => apiGet('/ap/bills', { status: 'Approved', limit: 200 }),
    enabled: showCreate,
  });
  const approvedBills = approvedBillsResult?.data ?? [];

  const totalValue    = runs.reduce((s, r) => s + Number(r.totalAmount), 0);
  const pendingRuns   = runs.filter((r) => r.status === 'Draft').length;
  const approvedRuns  = runs.filter((r) => r.status === 'Approved').length;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ap-payment-runs'] });
    qc.invalidateQueries({ queryKey: ['ap-bills'] });
  };
  const approveMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/ap/payment-runs/${id}/approve`), onSuccess: invalidate });

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { description: '', paymentDate: new Date().toISOString().split('T')[0], currency: 'USD' },
  });

  const selectedTotal = approvedBills.filter((b) => selectedBills.includes(b.id))
    .reduce((s, b) => s + Number(b.totalAmount) - Number(b.amountPaid ?? 0), 0);

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiPost('/ap/payment-runs', data, { 'Idempotency-Key': uuidv4() }),
    onSuccess: () => { invalidate(); setShowCreate(false); reset(); setSelectedBills([]); },
  });

  const columns: Column<PaymentRun>[] = [
    { key: 'runNumber',    header: 'Run #', className: 'w-36', render: (r) => <span className="font-mono text-[13px] font-medium">{r.runNumber}</span> },
    { key: 'description', header: 'Description', render: (r) => r.description ?? <span className="text-ink-300">—</span> },
    { key: 'paymentDate', header: 'Payment Date', render: (r) => formatDate(r.paymentDate) },
    { key: 'totalAmount', header: 'Total', tdClassName: 'num', render: (r) => formatCurrency(r.totalAmount, r.currency) },
    { key: 'status',      header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: '', className: 'w-24',
      render: (r) => r.status === 'Draft' ? (
        <div onClick={(e) => e.stopPropagation()}>
          <button onClick={() => approveMutation.mutate(r.id)} className="text-[11px] font-medium text-success hover:text-green-800 flex items-center gap-1 transition-colors">
            <CheckCircle2 className="w-3 h-3" />Approve
          </button>
        </div>
      ) : null,
    },
  ];

  if (isError) {
    return (
      <div className="page">
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <AlertCircle className="w-10 h-10 text-danger" />
          <p className="text-[15px] font-medium text-ink-700">Could not load payment runs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Payment Runs"
        subtitle="Batch supplier payments"
        actions={
          <>
            <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Export</Button>
            <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreate(true)}>New Payment Run</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Runs"    value={runs.length} />
        <KpiCard label="Total Value"   value={formatCurrency(totalValue)} accent="gold" />
        <KpiCard label="Draft"         value={pendingRuns}  accent={pendingRuns > 0 ? 'warning' : 'default'} />
        <KpiCard label="Approved"      value={approvedRuns} accent="success" />
      </div>

      <DataTable
        columns={columns} data={runs} keyField="id"
        isLoading={isLoading} isError={isError}
        onRowClick={setSelected}
        emptyMessage="No payment runs yet."
        emptyIcon={<CreditCard className="w-8 h-8" />}
      />

      {/* Detail drawer */}
      {selected && (
        <DetailDrawer
          title={selected.runNumber}
          subtitle={`${formatCurrency(selected.totalAmount, selected.currency)} · ${formatDate(selected.paymentDate)}`}
          onClose={() => setSelected(null)}
          actions={selected.status === 'Draft' ? (
            <Button size="sm" variant="gold" isLoading={approveMutation.isPending} onClick={() => approveMutation.mutate(selected.id)}>Approve Run</Button>
          ) : undefined}
          tabs={[
            {
              id: 'details', label: 'Details',
              content: (
                <dl>
                  {[
                    { label: 'Run Number',    value: selected.runNumber },
                    { label: 'Description',   value: selected.description ?? '—' },
                    { label: 'Payment Date',  value: formatDate(selected.paymentDate) },
                    { label: 'Total Amount',  value: <span className="font-semibold">{formatCurrency(selected.totalAmount, selected.currency)}</span> },
                    { label: 'Currency',      value: selected.currency },
                    { label: 'Status',        value: <StatusBadge status={selected.status} /> },
                    { label: 'Bills in run',  value: Array.isArray(selected.billIds) ? selected.billIds.length : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between py-2.5 border-b border-border last:border-0">
                      <dt className="text-[13px] text-ink-600">{label}</dt>
                      <dd className="text-[13px] text-ink-900 font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              ),
            },
            { id: 'audit',     label: 'Audit Trail', content: <AuditTrailTab tenantId={tenantId} resourceType="payment_run" resourceId={selected.id} /> },
            { id: 'documents', label: 'Documents',   content: <DocumentsTab /> },
          ]}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal
          title="New Payment Run"
          subtitle="Select approved bills to include in this payment run."
          size="lg"
          onClose={() => { setShowCreate(false); reset(); setSelectedBills([]); }}
          footer={
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-ink-600">
                {selectedBills.length} bill{selectedBills.length !== 1 ? 's' : ''} selected · <strong>{formatCurrency(selectedTotal)}</strong>
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setShowCreate(false); reset(); setSelectedBills([]); }}>Cancel</Button>
                <Button
                  form="create-payrun-form" type="submit"
                  isLoading={createMutation.isPending}
                  disabled={selectedBills.length === 0}
                >
                  Create Run
                </Button>
              </div>
            </div>
          }
        >
          <form id="create-payrun-form" className="space-y-4" onSubmit={handleSubmit((d) => createMutation.mutate({ ...d, billIds: selectedBills }))} noValidate>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Description" placeholder="e.g. October 2026 run" {...register('description')} />
              <Input label="Payment Date" type="date" required {...register('paymentDate')} />
            </div>

            <div>
              <p className="field-label mb-2">Approved Bills to Include</p>
              {approvedBills.length === 0 ? (
                <div className="rounded-card border border-border p-6 text-center text-[13px] text-ink-400">
                  No approved bills available. Approve bills in the Bills screen first.
                </div>
              ) : (
                <div className="rounded-card border border-border divide-y divide-border max-h-64 overflow-y-auto">
                  {approvedBills.map((b) => {
                    const outstanding = Number(b.totalAmount) - Number(b.amountPaid ?? 0);
                    const checked = selectedBills.includes(b.id);
                    return (
                      <label key={b.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 cursor-pointer">
                        <input
                          type="checkbox" checked={checked}
                          onChange={(e) => setSelectedBills((prev) =>
                            e.target.checked ? [...prev, b.id] : prev.filter((id) => id !== b.id),
                          )}
                          className="rounded border-border text-gold-500 focus:ring-gold-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-ink-900">{b.billNumber}</p>
                          <p className="text-[12px] text-ink-600">{b.supplier?.name} · Due {formatDate(b.dueDate)}</p>
                        </div>
                        <span className="text-[13px] font-semibold tabular-nums text-ink-900">{formatCurrency(outstanding)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            {createMutation.isError && (
              <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">Failed to create payment run.</p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
