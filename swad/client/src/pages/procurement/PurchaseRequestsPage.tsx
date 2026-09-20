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

interface PurchaseRequest {
  id: string; prNumber: string; title: string; department?: string;
  totalAmount: number; currency: string; status: string; requiredBy?: string;
}

export function PurchaseRequestsPage() {
  const [showModal, setShowModal] = useState(false);
  const qc = useQueryClient();

  const { data: prs = [], isLoading } = useQuery<PurchaseRequest[]>({ queryKey: ['purchase-requests'], queryFn: () => apiGet('/procurement/requests') });
  const { register, handleSubmit, reset } = useForm({ defaultValues: { title: '', department: '', totalAmount: 0, currency: 'USD', requiredBy: '', notes: '' } });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiPost('/procurement/requests', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-requests'] }); setShowModal(false); reset(); },
  });
  const approveMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/procurement/requests/${id}/approve`), onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-requests'] }) });

  const columns: Column<PurchaseRequest>[] = [
    { key: 'prNumber', header: 'PR #', className: 'font-mono font-medium' },
    { key: 'title', header: 'Title', className: 'max-w-xs' },
    { key: 'department', header: 'Department', render: r => r.department ?? '—' },
    { key: 'totalAmount', header: 'Est. Value', render: r => formatCurrency(r.totalAmount, r.currency), className: 'text-right' },
    { key: 'requiredBy', header: 'Required By', render: r => r.requiredBy ? formatDate(r.requiredBy) : '—' },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status as RecordStatus} /> },
    { key: 'actions', header: '', render: r => r.status === 'Pending' ? (
      <button onClick={e => { e.stopPropagation(); approveMutation.mutate(r.id); }} className="text-xs text-green-600 hover:underline flex items-center gap-1"><CheckCircle className="w-3 h-3" />Approve</button>
    ) : null },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Purchase Requests" subtitle="Procurement & Spend"
        actions={<Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-1" />New Request</Button>} />
      <DataTable columns={columns} data={prs} keyField="id" isLoading={isLoading} />

      {showModal && (
        <Modal title="New Purchase Request" onClose={() => setShowModal(false)}>
          <form className="space-y-4" onSubmit={handleSubmit(d => createMutation.mutate(d))}>
            <Input label="Title / Description" required {...register('title')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Department" {...register('department')} />
              <Input label="Required By" type="date" {...register('requiredBy')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Estimated Amount" type="number" {...register('totalAmount', { valueAsNumber: true })} />
              <Input label="Notes" {...register('notes')} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={createMutation.isPending}>Submit Request</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
