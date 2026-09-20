import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Send, CheckCircle } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { Button } from '../../components/shared/Button';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Modal } from '../../components/shared/Modal';
import { Input } from '../../components/shared/Input';
import { Select } from '../../components/shared/Select';
import { apiGet, apiPost, apiPatch } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { RecordStatus } from '../../types';
import { useForm, useFieldArray } from 'react-hook-form';

interface ExpenseClaim {
  id: string; claimNumber: string; description: string;
  claimDate: string; totalAmount: number; currency: string; status: string;
  lines: { id: string; category: string; amount: number }[];
}

const CATEGORIES = ['Travel', 'Accommodation', 'Meals', 'Conference', 'Office Supplies', 'Software', 'Other'];

export function ExpensesPage() {
  const [showModal, setShowModal] = useState(false);
  const qc = useQueryClient();

  const { data: claims = [], isLoading } = useQuery<ExpenseClaim[]>({ queryKey: ['expense-claims'], queryFn: () => apiGet('/expenses/claims') });

  const { register, handleSubmit, control, reset, watch } = useForm({
    defaultValues: { description: '', claimDate: new Date().toISOString().split('T')[0], currency: 'USD', lines: [{ category: 'Travel', description: '', expenseDate: new Date().toISOString().split('T')[0], amount: 0, currency: 'USD' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiPost('/expenses/claims', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-claims'] }); setShowModal(false); reset(); },
  });
  const submitMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/expenses/claims/${id}/submit`), onSuccess: () => qc.invalidateQueries({ queryKey: ['expense-claims'] }) });
  const approveMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/expenses/claims/${id}/approve`), onSuccess: () => qc.invalidateQueries({ queryKey: ['expense-claims'] }) });

  const totalPending = claims.filter(c => c.status === 'Pending').reduce((s, c) => s + c.totalAmount, 0);

  const columns: Column<ExpenseClaim>[] = [
    { key: 'claimNumber', header: 'Claim #', className: 'font-mono font-medium' },
    { key: 'description', header: 'Description' },
    { key: 'claimDate', header: 'Date', render: r => formatDate(r.claimDate) },
    { key: 'lines', header: 'Categories', render: r => <span className="text-xs text-gray-500">{[...new Set(r.lines?.map(l => l.category))].join(', ')}</span> },
    { key: 'totalAmount', header: 'Total', render: r => formatCurrency(r.totalAmount, r.currency), className: 'text-right font-medium' },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status as RecordStatus} /> },
    { key: 'actions', header: '', render: r => (
      <div className="flex gap-2">
        {r.status === 'Draft' && <button onClick={e => { e.stopPropagation(); submitMutation.mutate(r.id); }} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Send className="w-3 h-3" />Submit</button>}
        {r.status === 'Pending' && <button onClick={e => { e.stopPropagation(); approveMutation.mutate(r.id); }} className="text-xs text-green-600 hover:underline flex items-center gap-1"><CheckCircle className="w-3 h-3" />Approve</button>}
      </div>
    )},
  ];

  return (
    <div className="p-6">
      <PageHeader title="Expense Management" subtitle="Claims & reimbursements"
        actions={<Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-1" />New Claim</Button>} />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Claims', value: claims.length },
          { label: 'Pending Approval', value: claims.filter(c => c.status === 'Pending').length, highlight: true },
          { label: 'Pending Value', value: formatCurrency(totalPending), highlight: true },
          { label: 'Approved', value: claims.filter(c => c.status === 'Approved').length },
        ].map(card => (
          <div key={card.label} className={`bg-white rounded-lg shadow p-4 border-l-4 ${card.highlight ? 'border-yellow-400' : 'border-gray-200'}`}>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.highlight ? 'text-yellow-700' : 'text-gray-900'}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <DataTable columns={columns} data={claims} keyField="id" isLoading={isLoading} />

      {showModal && (
        <Modal title="New Expense Claim" onClose={() => setShowModal(false)} size="lg">
          <form className="space-y-4" onSubmit={handleSubmit(d => createMutation.mutate(d))}>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Description" required {...register('description')} />
              <Input label="Claim Date" type="date" required {...register('claimDate')} />
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className="px-3 py-2 text-left text-xs text-gray-500">Category</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500">Description</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500">Date</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-500 w-24">Amount</th>
                  <th className="w-8"></th>
                </tr></thead>
                <tbody className="divide-y">
                  {fields.map((f, i) => (
                    <tr key={f.id}>
                      <td className="px-2 py-1">
                        <select className="w-full border border-gray-300 rounded px-2 py-1 text-xs" {...register(`lines.${i}.category`)}>
                          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1"><input className="w-full border border-gray-300 rounded px-2 py-1 text-xs" {...register(`lines.${i}.description`)} /></td>
                      <td className="px-2 py-1"><input type="date" className="w-full border border-gray-300 rounded px-2 py-1 text-xs" {...register(`lines.${i}.expenseDate`)} /></td>
                      <td className="px-2 py-1"><input type="number" step="0.01" className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right" {...register(`lines.${i}.amount`, { valueAsNumber: true })} /></td>
                      <td className="px-2 py-1"><button type="button" onClick={() => remove(i)} className="text-red-400 text-xs">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t bg-gray-50">
                <button type="button" onClick={() => append({ category: 'Travel', description: '', expenseDate: new Date().toISOString().split('T')[0], amount: 0, currency: 'USD' })} className="text-xs text-brand-600 hover:underline">+ Add expense</button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={createMutation.isPending}>Save Claim</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
