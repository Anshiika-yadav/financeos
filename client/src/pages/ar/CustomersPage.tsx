import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { Button } from '../../components/shared/Button';
import { Modal } from '../../components/shared/Modal';
import { Input } from '../../components/shared/Input';
import { Select } from '../../components/shared/Select';
import { apiGet, apiPost } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { useForm } from 'react-hook-form';

interface Customer {
  id: string; code: string; name: string; email?: string;
  country?: string; currency: string; creditLimit: number; paymentTerms: number; isActive: boolean;
}

export function CustomersPage() {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({ queryKey: ['customers'], queryFn: () => apiGet('/ar/customers') });
  const { register, handleSubmit, reset } = useForm({ defaultValues: { name: '', email: '', phone: '', country: 'US', currency: 'USD', creditLimit: 50000, paymentTerms: 30 } });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiPost('/ar/customers', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setShowModal(false); reset(); },
  });

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()));

  const columns: Column<Customer>[] = [
    { key: 'code', header: 'Code', className: 'font-mono w-28' },
    { key: 'name', header: 'Customer Name', className: 'font-medium' },
    { key: 'email', header: 'Email', render: r => r.email ?? '—' },
    { key: 'country', header: 'Country', render: r => r.country ?? '—' },
    { key: 'currency', header: 'Currency' },
    { key: 'creditLimit', header: 'Credit Limit', render: r => formatCurrency(r.creditLimit, r.currency), className: 'text-right' },
    { key: 'paymentTerms', header: 'Terms', render: r => `Net ${r.paymentTerms}` },
    { key: 'isActive', header: 'Status', render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{r.isActive ? 'Active' : 'Inactive'}</span> },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Customers" subtitle={`${customers.length} customers`}
        actions={<Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-1" />Add Customer</Button>} />
      <div className="mb-4">
        <input placeholder="Search customers…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-80 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>
      <DataTable columns={columns} data={filtered} keyField="id" isLoading={isLoading} />

      {showModal && (
        <Modal title="Add Customer" onClose={() => setShowModal(false)}>
          <form className="space-y-4" onSubmit={handleSubmit(d => createMutation.mutate(d))}>
            <Input label="Customer Name" required {...register('name')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email" type="email" {...register('email')} />
              <Input label="Phone" {...register('phone')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Country" options={[{value:'US',label:'United States'},{value:'AU',label:'Australia'},{value:'GB',label:'United Kingdom'},{value:'SG',label:'Singapore'}]} {...register('country')} />
              <Select label="Currency" options={[{value:'USD',label:'USD'},{value:'AUD',label:'AUD'},{value:'GBP',label:'GBP'}]} {...register('currency')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Credit Limit" type="number" {...register('creditLimit', { valueAsNumber: true })} />
              <Input label="Payment Terms (days)" type="number" {...register('paymentTerms', { valueAsNumber: true })} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={createMutation.isPending}>Add Customer</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
