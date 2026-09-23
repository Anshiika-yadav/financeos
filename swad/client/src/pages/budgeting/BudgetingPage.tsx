import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, BarChart3, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuth } from '../../store/auth.context';
import { clsx } from 'clsx';
import { v4 as uuidv4 } from 'uuid';

interface BudgetLine { id: string; accountCode?: string; accountName: string; period: string; amount: number; actuals?: number; variance?: number; }
interface Budget { id: string; name: string; fiscalYear: string; version: string; status: string; totalAmount: number; currency: string; createdAt: string; lines?: BudgetLine[]; }
interface BudgetVariance { budget: Budget; variance: BudgetLine[]; }

const CURRENCIES = [{ value: 'USD', label: 'USD' }, { value: 'AUD', label: 'AUD' }, { value: 'GBP', label: 'GBP' }, { value: 'EUR', label: 'EUR' }];

export function BudgetingPage() {
  const { tenantContext } = useAuth() as any;
  const tenantId = tenantContext?.tenantId ?? '';
  const qc = useQueryClient();
  const [selected, setSelected]     = useState<Budget | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showVariance, setShowVariance] = useState(false);

  const { data: budgets = [], isLoading, isError } = useQuery<Budget[]>({ queryKey: ['budgets'], queryFn: () => apiGet('/budgeting') });
  const { data: varianceData } = useQuery<BudgetVariance>({
    queryKey: ['budget-variance', selected?.id],
    queryFn: () => apiGet(`/budgeting/${selected!.id}/variance`),
    enabled: !!selected && showVariance,
  });

  const totalBudgeted = budgets.reduce((s, b) => s + Number(b.totalAmount), 0);

  const { register, handleSubmit, reset } = useForm({ defaultValues: { name: '', fiscalYear: new Date().getFullYear().toString(), currency: 'USD' } });
  const createMutation = useMutation({
    mutationFn: (d: unknown) => apiPost('/budgeting', d, { 'Idempotency-Key': uuidv4() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets'] }); setShowCreate(false); reset(); },
  });

  const columns: Column<Budget>[] = [
    { key: 'name',        header: 'Budget Name',  render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'fiscalYear',  header: 'Fiscal Year' },
    { key: 'version',     header: 'Version' },
    { key: 'totalAmount', header: 'Total Amount', tdClassName: 'num font-semibold', render: (r) => formatCurrency(r.totalAmount, r.currency) },
    { key: 'status',      header: 'Status',       render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdAt',   header: 'Created',      render: (r) => formatDate(r.createdAt) },
  ];

  if (isError) return <div className="page"><div className="flex flex-col items-center justify-center py-24 gap-3"><AlertCircle className="w-10 h-10 text-danger" /><p className="text-[15px] font-medium text-ink-700">Could not load budgets</p></div></div>;

  return (
    <div className="page">
      <PageHeader title="Planning & Budgets" subtitle="Budget workspace"
        actions={<>
          <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Export</Button>
          <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreate(true)}>New Budget</Button>
        </>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Total Budgets"  value={budgets.length} />
        <KpiCard label="Total Budgeted" value={formatCurrency(totalBudgeted)} accent="gold" />
        <KpiCard label="Approved"       value={budgets.filter((b) => b.status === 'Approved').length} accent="success" />
      </div>
      <DataTable columns={columns} data={budgets} keyField="id" isLoading={isLoading} isError={isError}
        onRowClick={setSelected} emptyMessage="No budgets found." emptyIcon={<BarChart3 className="w-8 h-8" />} />

      {selected && (
        <DetailDrawer title={selected.name} subtitle={`${selected.fiscalYear} · ${selected.version}`} onClose={() => { setSelected(null); setShowVariance(false); }}
          actions={<Button size="sm" variant="secondary" onClick={() => setShowVariance((v) => !v)}>{showVariance ? 'Hide Variance' : 'View Variance'}</Button>}
          tabs={[
            { id: 'details', label: 'Details', content: (
              <div className="space-y-4">
                <dl>{[
                  { label: 'Name',        value: selected.name },
                  { label: 'Fiscal Year', value: selected.fiscalYear },
                  { label: 'Version',     value: selected.version },
                  { label: 'Total',       value: <span className="font-semibold">{formatCurrency(selected.totalAmount, selected.currency)}</span> },
                  { label: 'Status',      value: <StatusBadge status={selected.status} /> },
                ].map(({ label, value }) => <div key={label} className="flex justify-between py-2.5 border-b border-border last:border-0"><dt className="text-[13px] text-ink-600">{label}</dt><dd className="text-[13px] text-ink-900 font-medium">{value}</dd></div>)}</dl>

                {/* Variance table */}
                {showVariance && varianceData && (
                  <div>
                    <p className="field-label mb-2">Budget vs Actuals</p>
                    <div className="rounded-card border border-border overflow-hidden">
                      <table className="data-table">
                        <thead><tr>
                          <th>Account</th><th>Period</th>
                          <th className="num">Budget</th><th className="num">Actual</th>
                          <th className="num">Variance</th>
                        </tr></thead>
                        <tbody>
                          {varianceData.variance.map((line) => {
                            const variance = line.variance ?? 0;
                            return (
                              <tr key={line.id}>
                                <td>{line.accountName}</td>
                                <td className="text-ink-400">{line.period}</td>
                                <td className="num">{formatCurrency(Number(line.amount))}</td>
                                <td className="num">{formatCurrency(line.actuals ?? 0)}</td>
                                <td className={clsx('num font-medium', variance < 0 ? 'text-danger' : 'text-success')}>{formatCurrency(Math.abs(variance))}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )},
            { id: 'audit', label: 'Audit Trail', content: <AuditTrailTab tenantId={tenantId} resourceType="budget" resourceId={selected.id} /> },
            { id: 'documents', label: 'Documents', content: <DocumentsTab /> },
          ]}
        />
      )}

      {showCreate && (
        <Modal title="New Budget" onClose={() => { setShowCreate(false); reset(); }}
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button><Button form="create-budget-form" type="submit" isLoading={createMutation.isPending}>Create Budget</Button></div>}
        >
          <form id="create-budget-form" className="space-y-4" onSubmit={handleSubmit((d) => createMutation.mutate(d))} noValidate>
            <Input label="Budget Name" required placeholder="e.g. FY2026 Annual Budget" {...register('name')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Fiscal Year" required placeholder="2026" {...register('fiscalYear')} />
              <Select label="Currency" options={CURRENCIES} {...register('currency')} />
            </div>
            <p className="text-[12px] text-ink-600 bg-info-bg border border-info-border rounded-input px-3 py-2">
              Budget lines can be added after creation via the API or a CSV import.
            </p>
            {createMutation.isError && <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">Failed to create budget.</p>}
          </form>
        </Modal>
      )}
    </div>
  );
}
