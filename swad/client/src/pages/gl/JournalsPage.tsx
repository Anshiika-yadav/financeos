import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle, Send, FileCheck } from 'lucide-react';
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

interface Journal {
  id: string; journalNumber: string; description: string;
  postingDate: string; status: string; totalDebit: number; totalCredit: number;
  createdBy: string; period?: { name: string };
}

interface FiscalPeriod { id: string; name: string; status: string; }
interface GlAccount { id: string; code: string; name: string; }

export function JournalsPage() {
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const qc = useQueryClient();

  const { data: result, isLoading } = useQuery<{ data: Journal[] }>({
    queryKey: ['gl-journals', statusFilter],
    queryFn: () => apiGet('/gl/journals', statusFilter ? { status: statusFilter } : {}),
  });

  const { data: periods = [] } = useQuery<FiscalPeriod[]>({ queryKey: ['fiscal-periods'], queryFn: () => apiGet('/gl/periods') });
  const { data: accounts = [] } = useQuery<GlAccount[]>({ queryKey: ['gl-accounts'], queryFn: () => apiGet('/gl/accounts') });

  const journals = result?.data ?? [];

  const submitMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/gl/journals/${id}/submit`), onSuccess: () => qc.invalidateQueries({ queryKey: ['gl-journals'] }) });
  const approveMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/gl/journals/${id}/approve`), onSuccess: () => qc.invalidateQueries({ queryKey: ['gl-journals'] }) });
  const postMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/gl/journals/${id}/post`), onSuccess: () => qc.invalidateQueries({ queryKey: ['gl-journals'] }) });

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm({
    defaultValues: {
      description: '', fiscalPeriodId: '', postingDate: new Date().toISOString().split('T')[0],
      lines: [{ accountId: '', description: '', debit: 0, credit: 0, currency: 'USD' }, { accountId: '', description: '', debit: 0, credit: 0, currency: 'USD' }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiPost('/gl/journals', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gl-journals'] }); setShowModal(false); reset(); },
  });

  const columns: Column<Journal>[] = [
    { key: 'journalNumber', header: 'Number', className: 'font-mono font-medium' },
    { key: 'description', header: 'Description', className: 'max-w-xs truncate' },
    { key: 'postingDate', header: 'Date', render: r => formatDate(r.postingDate) },
    { key: 'period', header: 'Period', render: r => r.period?.name ?? '—' },
    { key: 'totalDebit', header: 'Debit', render: r => formatCurrency(r.totalDebit), className: 'text-right' },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status as RecordStatus} /> },
    { key: 'actions', header: '', render: r => (
      <div className="flex gap-2">
        {r.status === 'Draft' && <button onClick={e => { e.stopPropagation(); submitMutation.mutate(r.id); }} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Send className="w-3 h-3" />Submit</button>}
        {r.status === 'Pending' && <button onClick={e => { e.stopPropagation(); approveMutation.mutate(r.id); }} className="text-xs text-green-600 hover:underline flex items-center gap-1"><CheckCircle className="w-3 h-3" />Approve</button>}
        {r.status === 'Approved' && <button onClick={e => { e.stopPropagation(); postMutation.mutate(r.id); }} className="text-xs text-purple-600 hover:underline flex items-center gap-1"><FileCheck className="w-3 h-3" />Post</button>}
      </div>
    )},
  ];

  return (
    <div className="p-6">
      <PageHeader title="Journal Entries" subtitle={`${journals.length} entries`}
        actions={<Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-1" />New Journal</Button>} />

      <div className="flex gap-2 mb-4">
        {['', 'Draft', 'Pending', 'Approved', 'Posted'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={journals} keyField="id" isLoading={isLoading} />

      {showModal && (
        <Modal title="New Journal Entry" onClose={() => setShowModal(false)} size="xl">
          <form className="space-y-4" onSubmit={handleSubmit(d => createMutation.mutate(d))}>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Description" required {...register('description')} />
              <Input label="Posting Date" type="date" required {...register('postingDate')} />
            </div>
            <Select label="Fiscal Period" required options={periods.map(p => ({ value: p.id, label: p.name }))} placeholder="Select period" {...register('fiscalPeriodId')} />

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Account</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Description</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500">Debit</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500">Credit</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fields.map((field, i) => (
                    <tr key={field.id}>
                      <td className="px-2 py-1">
                        <select className="w-full border border-gray-300 rounded px-2 py-1 text-xs" {...register(`lines.${i}.accountId`)}>
                          <option value="">Select…</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1"><input className="w-full border border-gray-300 rounded px-2 py-1 text-xs" placeholder="Description" {...register(`lines.${i}.description`)} /></td>
                      <td className="px-2 py-1"><input type="number" step="0.01" className="w-28 border border-gray-300 rounded px-2 py-1 text-xs text-right" {...register(`lines.${i}.debit`, { valueAsNumber: true })} /></td>
                      <td className="px-2 py-1"><input type="number" step="0.01" className="w-28 border border-gray-300 rounded px-2 py-1 text-xs text-right" {...register(`lines.${i}.credit`, { valueAsNumber: true })} /></td>
                      <td className="px-2 py-1"><button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 text-xs">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t bg-gray-50">
                <button type="button" onClick={() => append({ accountId: '', description: '', debit: 0, credit: 0, currency: 'USD' })} className="text-xs text-brand-600 hover:underline">+ Add line</button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={createMutation.isPending}>Save Journal</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
