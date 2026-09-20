import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { Button } from '../../components/shared/Button';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Modal } from '../../components/shared/Modal';
import { Input } from '../../components/shared/Input';
import { apiGet, apiPost, apiPatch } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { RecordStatus } from '../../types';
import { useForm } from 'react-hook-form';

interface PaymentRun {
  id: string; runNumber: string; description?: string;
  paymentDate: string; totalAmount: number; currency: string;
  status: string; approvedBy?: string;
}
interface Bill { id: string; billNumber: string; supplier: { name: string }; totalAmount: number; status: string; }

export function PaymentRunsPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  const qc = useQueryClient();

  const { data: runs = [], isLoading } = useQuery<PaymentRun[]>({ queryKey: ['payment-runs'], queryFn: () => apiGet('/ap/payment-runs') });
  const { data: billsResult } = useQuery<{ data: Bill[] }>({ queryKey: ['bills-approved'], queryFn: () => apiGet('/ap/bills', { status: 'Approved' }) });
  const approvedBills = billsResult?.data ?? [];

  const approveMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/ap/payment-runs/${id}/approve`), onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-runs'] }) });

  const { register, handleSubmit, reset } = useForm({ defaultValues: { description: '', paymentDate: new Date().toISOString().split('T')[0], currency: 'USD' } });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiPost('/ap/payment-runs', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-runs'] }); setShowModal(false); reset(); setSelectedBills([]); },
  });

  const columns: Column<PaymentRun>[] = [
    { key: 'runNumber', header: 'Run #', className: 'font-mono font-medium' },
    { key: 'description', header: 'Description', render: r => r.description ?? '—' },
    { key: 'paymentDate', header: 'Payment Date', render: r => formatDate(r.paymentDate) },
    { key: 'totalAmount', header: 'Total', render: r => formatCurrency(r.totalAmount, r.currency), className: 'text-right font-medium' },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status as RecordStatus} /> },
    { key: 'actions', header: '', render: r => r.status === 'Draft' ? (
      <button onClick={e => { e.stopPropagation(); approveMutation.mutate(r.id); }} className="text-xs text-green-600 hover:underline flex items-center gap-1"><CheckCircle className="w-3 h-3" />Approve</button>
    ) : null },
  ];

  const selectedTotal = approvedBills.filter(b => selectedBills.includes(b.id)).reduce((s, b) => s + b.totalAmount, 0);

  return (
    <div className="p-6">
      <PageHeader title="Payment Runs" subtitle="Batch supplier payments"
        actions={<Button onClick={() => setShowModal(true)} disabled={approvedBills.length === 0}><Plus className="w-4 h-4 mr-1" />New Payment Run</Button>} />
      <DataTable columns={columns} data={runs} keyField="id" isLoading={isLoading} />

      {showModal && (
        <Modal title="New Payment Run" onClose={() => setShowModal(false)} size="lg">
          <form className="space-y-4" onSubmit={handleSubmit(d => createMutation.mutate({ ...d, billIds: selectedBills }))}>
            <Input label="Description" {...register('description')} />
            <Input label="Payment Date" type="date" required {...register('paymentDate')} />

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Select approved bills to include:</p>
              {approvedBills.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No approved bills available</p>
              ) : (
                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {approvedBills.map(b => (
                    <label key={b.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={selectedBills.includes(b.id)}
                        onChange={e => setSelectedBills(prev => e.target.checked ? [...prev, b.id] : prev.filter(id => id !== b.id))} />
                      <span className="flex-1 text-sm">{b.billNumber} — {b.supplier?.name}</span>
                      <span className="text-sm font-medium">{formatCurrency(b.totalAmount)}</span>
                    </label>
                  ))}
                </div>
              )}
              {selectedBills.length > 0 && (
                <p className="text-sm font-semibold text-gray-700 mt-2 text-right">Total: {formatCurrency(selectedTotal)}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" disabled={selectedBills.length === 0} isLoading={createMutation.isPending}>Create Run</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
