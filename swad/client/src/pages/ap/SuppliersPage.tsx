import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Building2 } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { Button } from '../../components/shared/Button';
import { Modal } from '../../components/shared/Modal';
import { Input } from '../../components/shared/Input';
import { Select } from '../../components/shared/Select';
import { apiGet, apiPost } from '../../services/api';
import { useForm } from 'react-hook-form';

interface Supplier {
  id: string; code: string; name: string; email?: string;
  country?: string; currency: string; paymentTerms: number; isActive: boolean;
}

export function SuppliersPage() {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers'], queryFn: () => apiGet('/ap/suppliers'),
  });

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { name: '', email: '', phone: '', country: 'AU', currency: 'USD', paymentTerms: 30, taxId: '' },
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiPost('/ap/suppliers', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setShowModal(false); reset(); },
  });

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()));

  const columns: Column<Supplier>[] = [
    { key: 'code', header: 'Code', className: 'font-mono w-28' },
    { key: 'name', header: 'Supplier Name', render: r => <span className="flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400" />{r.name}</span> },
    { key: 'email', header: 'Email', render: r => r.email ?? '—' },
    { key: 'country', header: 'Country', render: r => r.country ?? '—' },
    { key: 'currency', header: 'Currency' },
    { key: 'paymentTerms', header: 'Payment Terms', render: r => `Net ${r.paymentTerms}` },
    { key: 'isActive', header: 'Status', render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{r.isActive ? 'Active' : 'Inactive'}</span> },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Suppliers" subtitle={`${suppliers.length} suppliers`}
        actions={<Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-1" />Add Supplier</Button>} />
      <div className="mb-4">
        <input placeholder="Search suppliers…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-80 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>
      <DataTable columns={columns} data={filtered} keyField="id" isLoading={isLoading} />

      {showModal && (
        <Modal title="Add Supplier" onClose={() => setShowModal(false)}>
          <form className="space-y-4" onSubmit={handleSubmit(d => createMutation.mutate(d))}>
            <Input label="Supplier Name" required {...register('name')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email" type="email" {...register('email')} />
              <Input label="Phone" {...register('phone')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Country" options={[{value:'AU',label:'Australia'},{value:'US',label:'United States'},{value:'GB',label:'United Kingdom'},{value:'SG',label:'Singapore'}]} {...register('country')} />
              <Select label="Currency" options={[{value:'USD',label:'USD'},{value:'AUD',label:'AUD'},{value:'GBP',label:'GBP'}]} {...register('currency')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Tax ID / ABN" {...register('taxId')} />
              <Input label="Payment Terms (days)" type="number" {...register('paymentTerms', { valueAsNumber: true })} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={createMutation.isPending}>Add Supplier</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
