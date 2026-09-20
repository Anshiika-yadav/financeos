import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Search, Users, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { Button } from '../../components/shared/Button';
import { Modal } from '../../components/shared/Modal';
import { Input } from '../../components/shared/Input';
import { Select } from '../../components/shared/Select';
import { KpiCard } from '../../components/shared/KpiCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { DetailDrawer } from '../../components/shared/DetailDrawer';
import { AuditTrailTab } from '../../components/shared/AuditTrailTab';
import { DocumentsTab } from '../../components/shared/DocumentsTab';
import { apiGet, apiPost } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { useAuth } from '../../store/auth.context';
import { v4 as uuidv4 } from 'uuid';

interface Customer {
  id: string; code: string; name: string; email?: string; phone?: string;
  country?: string; currency: string; creditLimit: number; paymentTerms: number; isActive: boolean;
}

const schema = z.object({
  name:         z.string().min(1, 'Name is required'),
  email:        z.string().email('Invalid email').optional().or(z.literal('')),
  phone:        z.string().optional(),
  address:      z.string().optional(),
  country:      z.string().optional(),
  currency:     z.string().length(3).default('USD'),
  creditLimit:  z.number().min(0).default(0),
  paymentTerms: z.number().int().min(1).default(30),
});
type CreateForm = z.infer<typeof schema>;

const COUNTRIES  = [{ value: 'US', label: 'United States' }, { value: 'AU', label: 'Australia' }, { value: 'GB', label: 'United Kingdom' }, { value: 'SG', label: 'Singapore' }, { value: 'DE', label: 'Germany' }];
const CURRENCIES = [{ value: 'USD', label: 'USD' }, { value: 'AUD', label: 'AUD' }, { value: 'GBP', label: 'GBP' }, { value: 'EUR', label: 'EUR' }];

export function CustomersPage() {
  const { tenantContext } = useAuth() as any;
  const tenantId = tenantContext?.tenantId ?? '';
  const qc = useQueryClient();
  const [search, setSearch]         = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected]     = useState<Customer | null>(null);

  const { data: customers = [], isLoading, isError } = useQuery<Customer[]>({
    queryKey: ['ar-customers'],
    queryFn: () => apiGet('/ar/customers'),
  });
  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
  });
  const active = customers.filter((c) => c.isActive).length;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({ resolver: zodResolver(schema), defaultValues: { currency: 'USD', paymentTerms: 30, creditLimit: 0 } });
  const createMutation = useMutation({
    mutationFn: (d: CreateForm) => apiPost('/ar/customers', { ...d, email: d.email || undefined }, { 'Idempotency-Key': uuidv4() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ar-customers'] }); setShowCreate(false); reset(); },
  });

  const columns: Column<Customer>[] = [
    { key: 'code', header: 'Code', className: 'w-28', render: (r) => <span className="font-mono text-[13px] font-medium">{r.code}</span> },
    { key: 'name', header: 'Customer Name', render: (r) => <span className="font-medium text-ink-900">{r.name}</span> },
    { key: 'email',        header: 'Email',         render: (r) => r.email ?? <span className="text-ink-300">—</span> },
    { key: 'country',      header: 'Country',       render: (r) => r.country ?? <span className="text-ink-300">—</span> },
    { key: 'currency',     header: 'Currency' },
    { key: 'creditLimit',  header: 'Credit Limit',  tdClassName: 'num', render: (r) => formatCurrency(r.creditLimit, r.currency) },
    { key: 'paymentTerms', header: 'Terms',         render: (r) => `Net ${r.paymentTerms}` },
    { key: 'isActive',     header: 'Status',        render: (r) => <StatusBadge status={r.isActive ? 'Active' : 'Inactive'} /> },
  ];

  if (isError) return <div className="page"><div className="flex flex-col items-center justify-center py-24 gap-3"><AlertCircle className="w-10 h-10 text-danger" /><p className="text-[15px] font-medium text-ink-700">Could not load customers</p></div></div>;

  return (
    <div className="page">
      <PageHeader title="Customers" subtitle={`${customers.length} customers`}
        actions={<>
          <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Export</Button>
          <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreate(true)}>Add Customer</Button>
        </>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Total Customers" value={customers.length} />
        <KpiCard label="Active"          value={active}                   accent="success" />
        <KpiCard label="Inactive"        value={customers.length - active} accent={customers.length - active > 0 ? 'warning' : 'default'} />
      </div>
      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…" className="field-input pl-9" />
        </div>
      </div>
      <DataTable columns={columns} data={filtered} keyField="id" isLoading={isLoading} isError={isError}
        onRowClick={setSelected} emptyMessage="No customers found." emptyIcon={<Users className="w-8 h-8" />} />

      {selected && (
        <DetailDrawer title={selected.name} subtitle={`${selected.code} · ${selected.country ?? ''}`} onClose={() => setSelected(null)}
          tabs={[
            { id: 'details', label: 'Details', content: (
              <dl>{[
                { label: 'Code',          value: selected.code },
                { label: 'Email',         value: selected.email ?? '—' },
                { label: 'Phone',         value: selected.phone ?? '—' },
                { label: 'Country',       value: selected.country ?? '—' },
                { label: 'Currency',      value: selected.currency },
                { label: 'Credit Limit',  value: formatCurrency(selected.creditLimit, selected.currency) },
                { label: 'Payment Terms', value: `Net ${selected.paymentTerms} days` },
                { label: 'Status',        value: <StatusBadge status={selected.isActive ? 'Active' : 'Inactive'} /> },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2.5 border-b border-border last:border-0">
                  <dt className="text-[13px] text-ink-600">{label}</dt>
                  <dd className="text-[13px] text-ink-900 font-medium">{value}</dd>
                </div>
              ))}</dl>
            )},
            { id: 'audit',     label: 'Audit Trail', content: <AuditTrailTab tenantId={tenantId} resourceType="customer" resourceId={selected.id} /> },
            { id: 'documents', label: 'Documents',   content: <DocumentsTab /> },
          ]}
        />
      )}

      {showCreate && (
        <Modal title="Add Customer" onClose={() => { setShowCreate(false); reset(); }}
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button><Button form="create-customer-form" type="submit" isLoading={createMutation.isPending}>Add Customer</Button></div>}
        >
          <form id="create-customer-form" className="space-y-4" onSubmit={handleSubmit((d) => createMutation.mutate(d))} noValidate>
            <Input label="Customer Name" required error={errors.name?.message} {...register('name')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
              <Input label="Phone" {...register('phone')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Country"  options={COUNTRIES}  placeholder="Select…" {...register('country')} />
              <Select label="Currency" options={CURRENCIES} {...register('currency')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Credit Limit" type="number" min="0" error={errors.creditLimit?.message}  {...register('creditLimit',  { valueAsNumber: true })} />
              <Input label="Payment Terms (days)"      error={errors.paymentTerms?.message} type="number" min="1" {...register('paymentTerms', { valueAsNumber: true })} />
            </div>
            {createMutation.isError && <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">Failed to add customer.</p>}
          </form>
        </Modal>
      )}
    </div>
  );
}
