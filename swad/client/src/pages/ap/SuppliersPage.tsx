import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Search, Building2, AlertCircle } from 'lucide-react';
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
import { useAuth } from '../../store/auth.context';
import { v4 as uuidv4 } from 'uuid';

interface Supplier {
  id: string; code: string; name: string; email?: string; phone?: string;
  country?: string; currency: string; paymentTerms: number;
  bankName?: string; bankAccount?: string; isActive: boolean; createdAt: string;
}

const createSchema = z.object({
  name:         z.string().min(1, 'Name is required'),
  email:        z.string().email('Invalid email').optional().or(z.literal('')),
  phone:        z.string().optional(),
  address:      z.string().optional(),
  country:      z.string().optional(),
  currency:     z.string().length(3).default('USD'),
  taxId:        z.string().optional(),
  paymentTerms: z.number().int().min(1).default(30),
});
type CreateForm = z.infer<typeof createSchema>;

const COUNTRIES  = [{ value: 'US', label: 'United States' }, { value: 'AU', label: 'Australia' }, { value: 'GB', label: 'United Kingdom' }, { value: 'SG', label: 'Singapore' }, { value: 'IN', label: 'India' }, { value: 'DE', label: 'Germany' }];
const CURRENCIES = [{ value: 'USD', label: 'USD' }, { value: 'AUD', label: 'AUD' }, { value: 'GBP', label: 'GBP' }, { value: 'EUR', label: 'EUR' }];

export function SuppliersPage() {
  const { tenantContext } = useAuth() as any;
  const tenantId = tenantContext?.tenantId ?? '';
  const qc = useQueryClient();

  const [search, setSearch]         = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected]     = useState<Supplier | null>(null);

  const { data: suppliers = [], isLoading, isError } = useQuery<Supplier[]>({
    queryKey: ['ap-suppliers'],
    queryFn: () => apiGet('/ap/suppliers'),
  });

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q);
  });

  const active   = suppliers.filter((s) => s.isActive).length;
  const inactive = suppliers.length - active;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { currency: 'USD', paymentTerms: 30 },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) => apiPost('/ap/suppliers', { ...data, email: data.email || undefined }, { 'Idempotency-Key': uuidv4() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ap-suppliers'] }); setShowCreate(false); reset(); },
  });

  const columns: Column<Supplier>[] = [
    { key: 'code',  header: 'Code', className: 'w-28', render: (r) => <span className="font-mono text-[13px] font-medium">{r.code}</span> },
    { key: 'name',  header: 'Supplier Name', render: (r) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-surface-100 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-3.5 h-3.5 text-ink-400" />
        </div>
        <span className="font-medium text-ink-900">{r.name}</span>
      </div>
    )},
    { key: 'email',   header: 'Email',   render: (r) => r.email   ?? <span className="text-ink-300">—</span> },
    { key: 'country', header: 'Country', render: (r) => r.country ?? <span className="text-ink-300">—</span> },
    { key: 'currency',     header: 'Currency' },
    { key: 'paymentTerms', header: 'Terms', render: (r) => `Net ${r.paymentTerms}` },
    { key: 'isActive', header: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'Active' : 'Inactive'} /> },
  ];

  if (isError) {
    return (
      <div className="page">
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <AlertCircle className="w-10 h-10 text-danger" />
          <p className="text-[15px] font-medium text-ink-700">Could not load suppliers</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Suppliers"
        subtitle="Accounts Payable"
        actions={
          <>
            <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Export</Button>
            <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreate(true)}>Add Supplier</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Total Suppliers" value={suppliers.length} />
        <KpiCard label="Active"          value={active}   accent="success" />
        <KpiCard label="Inactive"        value={inactive} accent={inactive > 0 ? 'warning' : 'default'} />
      </div>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers…" className="field-input pl-9" />
        </div>
      </div>

      <DataTable
        columns={columns} data={filtered} keyField="id"
        isLoading={isLoading} isError={isError}
        onRowClick={setSelected}
        emptyMessage="No suppliers found. Add your first supplier."
        emptyIcon={<Building2 className="w-8 h-8" />}
      />

      {/* Detail drawer */}
      {selected && (
        <DetailDrawer
          title={selected.name}
          subtitle={`${selected.code} · ${selected.country ?? ''}`}
          onClose={() => setSelected(null)}
          tabs={[
            {
              id: 'details', label: 'Details',
              content: (
                <dl className="space-y-0">
                  {[
                    { label: 'Code',          value: selected.code },
                    { label: 'Email',         value: selected.email ?? '—' },
                    { label: 'Phone',         value: selected.phone ?? '—' },
                    { label: 'Country',       value: selected.country ?? '—' },
                    { label: 'Currency',      value: selected.currency },
                    { label: 'Payment Terms', value: `Net ${selected.paymentTerms} days` },
                    { label: 'Bank',          value: selected.bankName ?? '—' },
                    { label: 'Status',        value: <StatusBadge status={selected.isActive ? 'Active' : 'Inactive'} /> },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between py-2.5 border-b border-border last:border-0">
                      <dt className="text-[13px] text-ink-600">{label}</dt>
                      <dd className="text-[13px] text-ink-900 font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              ),
            },
            { id: 'audit',     label: 'Audit Trail', content: <AuditTrailTab tenantId={tenantId} resourceType="supplier" resourceId={selected.id} /> },
            { id: 'documents', label: 'Documents',   content: <DocumentsTab /> },
          ]}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal
          title="Add Supplier"
          onClose={() => { setShowCreate(false); reset(); }}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button>
              <Button form="create-supplier-form" type="submit" isLoading={createMutation.isPending}>Add Supplier</Button>
            </div>
          }
        >
          <form id="create-supplier-form" className="space-y-4" onSubmit={handleSubmit((d) => createMutation.mutate(d))} noValidate>
            <Input label="Supplier Name" required error={errors.name?.message} {...register('name')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
              <Input label="Phone" {...register('phone')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Country"  options={COUNTRIES}  placeholder="Select country…"  {...register('country')} />
              <Select label="Currency" options={CURRENCIES} {...register('currency')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Tax ID / VAT Number" {...register('taxId')} />
              <Input label="Payment Terms (days)" type="number" error={errors.paymentTerms?.message} {...register('paymentTerms', { valueAsNumber: true })} />
            </div>
            {createMutation.isError && (
              <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">Failed to add supplier.</p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
