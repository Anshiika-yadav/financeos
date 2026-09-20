import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { Button } from '../../components/shared/Button';
import { Modal } from '../../components/shared/Modal';
import { Input } from '../../components/shared/Input';
import { Select } from '../../components/shared/Select';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { apiGet, apiPost } from '../../services/api';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

interface GlAccount {
  id: string; code: string; name: string;
  accountType: string; normalBalance: string; isActive: boolean;
}

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  accountType: z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']),
  normalBalance: z.enum(['Debit', 'Credit']),
});

const TYPE_COLORS: Record<string, string> = {
  Asset: 'bg-blue-100 text-blue-800', Liability: 'bg-red-100 text-red-800',
  Equity: 'bg-purple-100 text-purple-800', Revenue: 'bg-green-100 text-green-800',
  Expense: 'bg-orange-100 text-orange-800',
};

export function AccountsPage() {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('');
  const qc = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery<GlAccount[]>({
    queryKey: ['gl-accounts'],
    queryFn: () => apiGet('/gl/accounts'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof schema>) => apiPost('/gl/accounts', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gl-accounts'] }); setShowModal(false); reset(); },
  });

  const filtered = accounts.filter(a =>
    a.code.toLowerCase().includes(filter.toLowerCase()) ||
    a.name.toLowerCase().includes(filter.toLowerCase()) ||
    a.accountType.toLowerCase().includes(filter.toLowerCase())
  );

  const columns: Column<GlAccount>[] = [
    { key: 'code', header: 'Code', className: 'font-mono font-medium w-24' },
    { key: 'name', header: 'Account Name' },
    { key: 'accountType', header: 'Type', render: r => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[r.accountType] ?? ''}`}>{r.accountType}</span>
    )},
    { key: 'normalBalance', header: 'Normal Balance' },
    { key: 'isActive', header: 'Status', render: r => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{r.isActive ? 'Active' : 'Inactive'}</span>
    )},
  ];

  return (
    <div className="p-6">
      <PageHeader title="Chart of Accounts" subtitle={`${accounts.length} accounts`}
        actions={<Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-1" />Add Account</Button>} />

      <div className="mb-4">
        <input placeholder="Search accounts..." value={filter} onChange={e => setFilter(e.target.value)}
          className="w-80 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      <div className="space-y-4">
        {['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map(type => {
          const group = filtered.filter(a => a.accountType === type);
          if (group.length === 0) return null;
          return (
            <div key={type}>
              <h3 className={`text-xs font-semibold uppercase tracking-wider px-1 mb-2 ${TYPE_COLORS[type]?.replace('bg-', 'text-').split(' ')[0]}`}>{type} Accounts</h3>
              <DataTable columns={columns} data={group} keyField="id" isLoading={isLoading} />
            </div>
          );
        })}
      </div>

      {showModal && (
        <Modal title="Add Account" onClose={() => setShowModal(false)}>
          <form className="space-y-4" onSubmit={handleSubmit(d => createMutation.mutate(d))}>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Account Code" required error={errors.code?.message} {...register('code')} />
              <Select label="Type" required options={['Asset','Liability','Equity','Revenue','Expense'].map(v=>({value:v,label:v}))} error={errors.accountType?.message} {...register('accountType')} />
            </div>
            <Input label="Account Name" required error={errors.name?.message} {...register('name')} />
            <Select label="Normal Balance" required options={[{value:'Debit',label:'Debit'},{value:'Credit',label:'Credit'}]} error={errors.normalBalance?.message} {...register('normalBalance')} />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={createMutation.isPending}>Create Account</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
