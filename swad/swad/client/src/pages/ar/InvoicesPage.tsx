import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle } from 'lucide-react';
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

interface Invoice {
  id: string; invoiceNumber: string;
  customer: { name: string; code: string };
  invoiceDate: string; dueDate: string;
  totalAmount: number; amountPaid: number; status: string; currency: string;
}
interface Customer { id: string; code: string; name: string; }

export function InvoicesPage() {
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const qc = useQueryClient();

  const { data: result, isLoading } = useQuery<{ data: Invoice[] }>({
    queryKey: ['invoices', statusFilter],
    queryFn: () => apiGet('/ar/invoices', statusFilter ? { status: statusFilter } : {}),
  });
  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ['customers'], queryFn: () => apiGet('/ar/customers') });

  const invoices = result?.data ?? [];
  const totalOutstanding = invoices.filter(i => !['Paid','Cancelled'].includes(i.status)).reduce((s, i) => s + i.totalAmount - (i.amountPaid ?? 0), 0);
  const overdue = invoices.filter(i => new Date(i.dueDate) < new Date() && !['Paid','Cancelled'].includes(i.status)).length;

  const approveMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/ar/invoices/${id}/approve`), onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }) });

  const { register, handleSubmit, control, reset } = useForm({
    defaultValues: {
      customerId: '', invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '', currency: 'USD', description: '',
      lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiPost('/ar/invoices', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setShowModal(false); reset(); },
  });

  const columns: Column<Invoice>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', className: 'font-mono font-medium' },
    { key: 'customer', header: 'Customer', render: r => r.customer?.name },
    { key: 'invoiceDate', header: 'Issue Date', render: r => formatDate(r.invoiceDate) },
    { key: 'dueDate', header: 'Due Date', render: r => <span className={new Date(r.dueDate) < new Date() && !['Paid'].includes(r.status) ? 'text-red-600 font-medium' : ''}>{formatDate(r.dueDate)}</span> },
    { key: 'totalAmount', header: 'Total', render: r => formatCurrency(r.totalAmount, r.currency), className: 'text-right' },
    { key: 'amountPaid', header: 'Paid', render: r => formatCurrency(r.amountPaid ?? 0, r.currency), className: 'text-right' },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status as RecordStatus} /> },
    { key: 'actions', header: '', render: r => r.status === 'Pending' ? (
      <button onClick={e => { e.stopPropagation(); approveMutation.mutate(r.id); }} className="text-xs text-green-600 hover:underline flex items-center gap-1"><CheckCircle className="w-3 h-3" />Approve</button>
    ) : null },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Sales Invoices" subtitle="Accounts Receivable"
        actions={<Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-1" />New Invoice</Button>} />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Invoices', value: invoices.length, sub: 'all time' },
          { label: 'Outstanding', value: formatCurrency(totalOutstanding), sub: 'unpaid balance', highlight: true },
          { label: 'Overdue', value: overdue, sub: 'past due date', danger: true },
          { label: 'Paid', value: invoices.filter(i => i.status === 'Paid').length, sub: 'this period' },
        ].map(card => (
          <div key={card.label} className={`bg-white rounded-lg shadow p-4 border-l-4 ${card.highlight ? 'border-blue-400' : card.danger ? 'border-red-400' : 'border-gray-200'}`}>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.danger ? 'text-red-600' : card.highlight ? 'text-blue-600' : 'text-gray-900'}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {['', 'Draft', 'Pending', 'Approved', 'Posted', 'Paid'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={invoices} keyField="id" isLoading={isLoading} />

      {showModal && (
        <Modal title="New Invoice" onClose={() => setShowModal(false)} size="xl">
          <form className="space-y-4" onSubmit={handleSubmit(d => createMutation.mutate(d))}>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Customer" required options={customers.map(c => ({ value: c.id, label: c.name }))} placeholder="Select customer" {...register('customerId')} />
              <Input label="Description" {...register('description')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Invoice Date" type="date" required {...register('invoiceDate')} />
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
              <Button type="submit" isLoading={createMutation.isPending}>Save Invoice</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
