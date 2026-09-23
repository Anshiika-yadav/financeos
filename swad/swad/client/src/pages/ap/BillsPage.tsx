import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle, Send } from 'lucide-react';
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

interface Bill {
  id: string; billNumber: string; reference?: string;
  supplier: { name: string; code: string };
  billDate: string; dueDate: string;
  totalAmount: number; amountPaid: number; status: string; currency: string;
}
interface Supplier { id: string; code: string; name: string; }

export function BillsPage() {
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const qc = useQueryClient();

  const { data: result, isLoading } = useQuery<{ data: Bill[] }>({
    queryKey: ['bills', statusFilter],
    queryFn: () => apiGet('/ap/bills', statusFilter ? { status: statusFilter } : {}),
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ['suppliers'], queryFn: () => apiGet('/ap/suppliers') });

  const bills = result?.data ?? [];
  const totalOutstanding = bills.filter(b => !['Paid', 'Cancelled'].includes(b.status)).reduce((s, b) => s + b.totalAmount - (b.amountPaid ?? 0), 0);

  const submitMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/ap/bills/${id}/submit`), onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }) });
  const approveMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/ap/bills/${id}/approve`), onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }) });

  const { register, handleSubmit, control, reset } = useForm({
    defaultValues: {
      supplierId: '', reference: '', billDate: new Date().toISOString().split('T')[0],
      dueDate: '', currency: 'USD',
      lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiPost('/ap/bills', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); setShowModal(false); reset(); },
  });

  const columns: Column<Bill>[] = [
    { key: 'billNumber', header: 'Bill #', className: 'font-mono font-medium' },
    { key: 'supplier', header: 'Supplier', render: r => r.supplier?.name },
    { key: 'reference', header: 'Reference', render: r => r.reference ?? '—' },
    { key: 'billDate', header: 'Bill Date', render: r => formatDate(r.billDate) },
    { key: 'dueDate', header: 'Due Date', render: r => <span className={new Date(r.dueDate) < new Date() && !['Paid'].includes(r.status) ? 'text-red-600 font-medium' : ''}>{formatDate(r.dueDate)}</span> },
    { key: 'totalAmount', header: 'Total', render: r => formatCurrency(r.totalAmount, r.currency), className: 'text-right' },
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
      <PageHeader title="Bills" subtitle="Accounts Payable"
        actions={<Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-1" />New Bill</Button>} />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Bills', value: bills.length, sub: 'all time' },
          { label: 'Outstanding', value: formatCurrency(totalOutstanding), sub: 'unpaid balance', highlight: true },
          { label: 'Pending Approval', value: bills.filter(b => b.status === 'Pending').length, sub: 'awaiting review' },
          { label: 'Overdue', value: bills.filter(b => new Date(b.dueDate) < new Date() && !['Paid','Cancelled'].includes(b.status)).length, sub: 'past due date', danger: true },
        ].map(card => (
          <div key={card.label} className={`bg-white rounded-lg shadow p-4 border-l-4 ${card.highlight ? 'border-orange-400' : card.danger ? 'border-red-400' : 'border-gray-200'}`}>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.danger ? 'text-red-600' : card.highlight ? 'text-orange-600' : 'text-gray-900'}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {['', 'Draft', 'Pending', 'Approved', 'Paid'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={bills} keyField="id" isLoading={isLoading} />

      {showModal && (
        <Modal title="New Bill" onClose={() => setShowModal(false)} size="xl">
          <form className="space-y-4" onSubmit={handleSubmit(d => createMutation.mutate(d))}>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Supplier" required options={suppliers.map(s => ({ value: s.id, label: s.name }))} placeholder="Select supplier" {...register('supplierId')} />
              <Input label="Supplier Reference" {...register('reference')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Bill Date" type="date" required {...register('billDate')} />
              <Input label="Due Date" type="date" required {...register('dueDate')} />
              <Select label="Currency" options={[{value:'USD',label:'USD'},{value:'AUD',label:'AUD'},{value:'GBP',label:'GBP'}]} {...register('currency')} />
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className="px-3 py-2 text-left text-xs text-gray-500">Description</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-500 w-20">Qty</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-500 w-28">Unit Price</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-500 w-20">Tax %</th>
                  <th className="w-8"></th>
                </tr></thead>
                <tbody className="divide-y">
                  {fields.map((f, i) => (
                    <tr key={f.id}>
                      <td className="px-2 py-1"><input className="w-full border border-gray-300 rounded px-2 py-1 text-xs" {...register(`lines.${i}.description`)} /></td>
                      <td className="px-2 py-1"><input type="number" className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right" {...register(`lines.${i}.quantity`, { valueAsNumber: true })} /></td>
                      <td className="px-2 py-1"><input type="number" step="0.01" className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right" {...register(`lines.${i}.unitPrice`, { valueAsNumber: true })} /></td>
                      <td className="px-2 py-1"><input type="number" className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right" {...register(`lines.${i}.taxRate`, { valueAsNumber: true })} /></td>
                      <td className="px-2 py-1"><button type="button" onClick={() => remove(i)} className="text-red-400 text-xs">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t bg-gray-50">
                <button type="button" onClick={() => append({ description: '', quantity: 1, unitPrice: 0, taxRate: 0 })} className="text-xs text-brand-600 hover:underline">+ Add line</button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={createMutation.isPending}>Save Bill</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
