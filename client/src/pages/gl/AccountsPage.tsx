import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Search, AlertCircle, BookOpen } from 'lucide-react';
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface GlAccount {
  id: string;
  code: string;
  name: string;
  accountType: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  normalBalance: 'Debit' | 'Credit';
  parentId: string | null;
  isActive: boolean;
  createdAt: string;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  accountType: z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']),
  normalBalance: z.enum(['Debit', 'Credit']),
  parentId: z.string().uuid().optional().or(z.literal('')),
});
type CreateForm = z.infer<typeof createSchema>;

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const;

const TYPE_META: Record<string, { color: string; bg: string }> = {
  Asset:     { color: 'text-info',    bg: 'bg-info-bg' },
  Liability: { color: 'text-danger',  bg: 'bg-danger-bg' },
  Equity:    { color: 'text-[#6D28D9]', bg: 'bg-purple-50' },
  Revenue:   { color: 'text-success', bg: 'bg-success-bg' },
  Expense:   { color: 'text-warning', bg: 'bg-warning-bg' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AccountsPage() {
  const { tenantContext } = useAuth() as any;
  const tenantId = tenantContext?.tenantId ?? '';
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<GlAccount | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: accounts = [], isLoading, isError } = useQuery<GlAccount[]>({
    queryKey: ['gl-accounts'],
    queryFn: () => apiGet('/gl/accounts'),
  });

  // ── Derived KPIs ────────────────────────────────────────────────────────────
  const total = accounts.length;
  const active = accounts.filter((a) => a.isActive).length;
  const byType = (t: string) => accounts.filter((a) => a.accountType === t).length;

  // ── Filtering ───────────────────────────────────────────────────────────────
  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase();
    const matchQ = !q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
    const matchT = !typeFilter || a.accountType === typeFilter;
    return matchQ && matchT;
  });

  // ── Create mutation ─────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { accountType: 'Asset', normalBalance: 'Debit' },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) =>
      apiPost('/gl/accounts', { ...data, parentId: data.parentId || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gl-accounts'] });
      setShowCreate(false);
      reset();
    },
  });

  // ── Columns ─────────────────────────────────────────────────────────────────
  const columns: Column<GlAccount>[] = [
    {
      key: 'code',
      header: 'Code',
      className: 'w-28',
      render: (r) => <span className="font-mono text-[13px] text-ink-900 font-medium">{r.code}</span>,
    },
    { key: 'name', header: 'Account Name' },
    {
      key: 'accountType',
      header: 'Type',
      render: (r) => {
        const m = TYPE_META[r.accountType] ?? { color: 'text-ink-600', bg: 'bg-surface-100' };
        return (
          <span className={`status-chip ${m.bg} ${m.color}`}>{r.accountType}</span>
        );
      },
    },
    { key: 'normalBalance', header: 'Normal Balance' },
    {
      key: 'isActive',
      header: 'Status',
      render: (r) => <StatusBadge status={r.isActive ? 'Active' : 'Inactive'} />,
    },
  ];

  // ── Permission-denied state ──────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="page">
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-ink-400">
          <AlertCircle className="w-10 h-10 text-danger" />
          <p className="text-[15px] font-medium text-ink-700">Could not load Chart of Accounts</p>
          <p className="text-[13px]">You may not have permission, or the server is unavailable.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* ── Page header ── */}
      <PageHeader
        title="Chart of Accounts"
        subtitle={`${total} accounts across ${ACCOUNT_TYPES.length} types`}
        actions={
          <>
            <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>
              Export
            </Button>
            <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreate(true)}>
              Add Account
            </Button>
          </>
        }
      />

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Total" value={total} sub="all accounts" />
        <KpiCard label="Active" value={active} accent="success" />
        {ACCOUNT_TYPES.map((t) => (
          <KpiCard key={t} label={t} value={byType(t)} />
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or name…"
            className="field-input pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {['', ...ACCOUNT_TYPES].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`filter-chip ${typeFilter === t ? 'filter-chip--active' : ''}`}
            >
              {t || 'All types'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grouped table ── */}
      {isLoading ? (
        <DataTable columns={columns} data={[]} keyField="id" isLoading />
      ) : (
        <div className="space-y-5">
          {ACCOUNT_TYPES.filter((t) => !typeFilter || t === typeFilter).map((type) => {
            const group = filtered.filter((a) => a.accountType === type);
            if (group.length === 0) return null;
            const m = TYPE_META[type];
            return (
              <div key={type}>
                <h2 className={`section-title text-[13px] uppercase tracking-widest mb-2 ${m.color}`}>
                  {type} Accounts <span className="text-ink-400 font-normal normal-case tracking-normal ml-1">({group.length})</span>
                </h2>
                <DataTable
                  columns={columns}
                  data={group}
                  keyField="id"
                  onRowClick={(row) => setSelected(row)}
                  emptyMessage={`No ${type.toLowerCase()} accounts match your search.`}
                />
              </div>
            );
          })}
          {filtered.length === 0 && !isLoading && (
            <div className="flex flex-col items-center gap-2 py-16 text-ink-400">
              <BookOpen className="w-8 h-8" />
              <p className="text-[13px]">No accounts match your filters.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Detail drawer ── */}
      {selected && (
        <DetailDrawer
          title={`${selected.code} — ${selected.name}`}
          subtitle={`${selected.accountType} · ${selected.normalBalance} balance`}
          onClose={() => setSelected(null)}
          tabs={[
            {
              id: 'details',
              label: 'Details',
              content: (
                <dl className="space-y-4">
                  {[
                    { label: 'Account Code',   value: selected.code },
                    { label: 'Account Name',   value: selected.name },
                    { label: 'Type',           value: selected.accountType },
                    { label: 'Normal Balance', value: selected.normalBalance },
                    { label: 'Status',         value: <StatusBadge status={selected.isActive ? 'Active' : 'Inactive'} /> },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between gap-4 py-2 border-b border-border last:border-0">
                      <dt className="text-[13px] text-ink-600 flex-shrink-0">{label}</dt>
                      <dd className="text-[13px] text-ink-900 font-medium text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
              ),
            },
            {
              id: 'audit',
              label: 'Audit Trail',
              content: (
                <AuditTrailTab
                  tenantId={tenantId}
                  resourceType="account"
                  resourceId={selected.id}
                />
              ),
            },
            {
              id: 'documents',
              label: 'Documents',
              content: <DocumentsTab />,
            },
          ]}
        />
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <Modal
          title="Add Account"
          subtitle="New account will appear in the Chart of Accounts immediately."
          onClose={() => { setShowCreate(false); reset(); }}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setShowCreate(false); reset(); }}>
                Cancel
              </Button>
              <Button
                form="create-account-form"
                type="submit"
                isLoading={createMutation.isPending}
              >
                Create Account
              </Button>
            </div>
          }
        >
          <form
            id="create-account-form"
            className="space-y-4"
            onSubmit={handleSubmit((d) => createMutation.mutate(d))}
            noValidate
          >
            <div className="grid grid-cols-2 gap-4">
              <Input label="Account Code" required error={errors.code?.message} {...register('code')} />
              <Select
                label="Type"
                required
                options={ACCOUNT_TYPES.map((v) => ({ value: v, label: v }))}
                error={errors.accountType?.message}
                {...register('accountType')}
              />
            </div>
            <Input label="Account Name" required error={errors.name?.message} {...register('name')} />
            <Select
              label="Normal Balance"
              required
              options={[{ value: 'Debit', label: 'Debit' }, { value: 'Credit', label: 'Credit' }]}
              error={errors.normalBalance?.message}
              {...register('normalBalance')}
            />
            {createMutation.isError && (
              <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">
                Failed to create account. Check the code is not already in use.
              </p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
