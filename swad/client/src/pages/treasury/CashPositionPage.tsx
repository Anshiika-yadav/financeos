import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Landmark, TrendingUp, TrendingDown, Plus, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '../../components/shared/PageHeader';
import { KpiCard } from '../../components/shared/KpiCard';
import { Button } from '../../components/shared/Button';
import { Modal } from '../../components/shared/Modal';
import { Input } from '../../components/shared/Input';
import { Select } from '../../components/shared/Select';
import { apiGet, apiPost } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { clsx } from 'clsx';
import { v4 as uuidv4 } from 'uuid';

interface BankAccount { id: string; accountName: string; bankName: string; accountNumber: string; bsb?: string; currency: string; currentBalance: number; isActive: boolean; }
interface CashPosition { accounts: BankAccount[]; totalCash: number; pendingPayments: number; outstandingAR: number; }

const CURRENCIES = [{ value: 'USD', label: 'USD' }, { value: 'AUD', label: 'AUD' }, { value: 'GBP', label: 'GBP' }, { value: 'EUR', label: 'EUR' }];

export function CashPositionPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading, isError } = useQuery<CashPosition>({ queryKey: ['treasury-cash-position'], queryFn: () => apiGet('/treasury/cash-position') });

  const netCash        = (data?.totalCash ?? 0) - (data?.pendingPayments ?? 0);
  const netCashPositive = netCash >= 0;

  const { register, handleSubmit, reset } = useForm({ defaultValues: { accountName: '', bankName: '', accountNumber: '', bsb: '', currency: 'USD', currentBalance: 0 } });
  const createMutation = useMutation({
    mutationFn: (d: unknown) => apiPost('/treasury/bank-accounts', d, { 'Idempotency-Key': uuidv4() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['treasury-cash-position'] }); setShowCreate(false); reset(); },
  });

  if (isError) return <div className="page"><div className="flex flex-col items-center justify-center py-24 gap-3"><AlertCircle className="w-10 h-10 text-danger" /><p className="text-[15px] font-medium text-ink-700">Could not load cash position</p></div></div>;

  if (isLoading) return (
    <div className="page">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-surface-100 rounded" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-surface-100 rounded-card" />)}</div>
        <div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-surface-100 rounded-card" />)}</div>
      </div>
    </div>
  );

  return (
    <div className="page">
      <PageHeader title="Cash Position" subtitle="Real-time treasury overview"
        actions={<Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreate(true)}>Add Bank Account</Button>}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Cash"        value={formatCurrency(data?.totalCash ?? 0)}         accent="success" />
        <KpiCard label="Pending Payments"  value={formatCurrency(data?.pendingPayments ?? 0)}   accent="warning" />
        <KpiCard label="Outstanding AR"    value={formatCurrency(data?.outstandingAR ?? 0)}     accent="info" />
        <KpiCard label="Net Cash Position" value={formatCurrency(netCash)} accent={netCashPositive ? 'success' : 'danger'}
          trend={netCashPositive ? 'up' : 'down'} trendLabel="after pending payments" />
      </div>

      {/* Net position banner */}
      <div className={clsx('flex items-center justify-between rounded-card2 px-6 py-5 mb-6 border', netCashPositive ? 'bg-navy-950 border-navy-800' : 'bg-danger-bg border-danger-border')}>
        <div>
          <p className={clsx('text-[13px] font-medium mb-1', netCashPositive ? 'text-navy-200' : 'text-danger')}>Net Cash Position</p>
          <p className={clsx('text-[32px] font-semibold tabular-nums', netCashPositive ? 'text-white' : 'text-danger')}>{formatCurrency(netCash)}</p>
          <p className={clsx('text-[12px] mt-1', netCashPositive ? 'text-navy-200' : 'text-ink-600')}>After {formatCurrency(data?.pendingPayments ?? 0)} in pending payments</p>
        </div>
        <div className="text-right">
          <p className={clsx('text-[13px] mb-1', netCashPositive ? 'text-navy-200' : 'text-ink-600')}>Expected AR inflow</p>
          <p className={clsx('text-[20px] font-semibold flex items-center gap-1 justify-end tabular-nums', netCashPositive ? 'text-green-300' : 'text-success')}>
            <TrendingUp className="w-5 h-5" />{formatCurrency(data?.outstandingAR ?? 0)}
          </p>
        </div>
      </div>

      {/* Bank accounts grid */}
      <h2 className="section-title mb-4">Bank Accounts</h2>
      {(data?.accounts ?? []).length === 0 ? (
        <div className="stat-card flex flex-col items-center gap-2 py-12 text-ink-400">
          <Landmark className="w-8 h-8" />
          <p className="text-[13px]">No bank accounts added yet.</p>
          <Button size="sm" onClick={() => setShowCreate(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>Add Bank Account</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(data?.accounts ?? []).map((acc) => (
            <div key={acc.id} className="stat-card flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-card bg-navy-950 flex items-center justify-center flex-shrink-0">
                  <Landmark className="w-4 h-4 text-gold-500" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-ink-900">{acc.accountName}</p>
                  <p className="text-[13px] text-ink-600">{acc.bankName}</p>
                  <p className="text-[12px] text-ink-400 font-mono mt-0.5">{acc.accountNumber}</p>
                  {acc.bsb && <p className="text-[11px] text-ink-400">BSB: {acc.bsb}</p>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[11px] text-ink-400 uppercase tracking-wider mb-0.5">{acc.currency}</p>
                <p className="text-[22px] font-semibold text-ink-900 tabular-nums">{formatCurrency(acc.currentBalance, acc.currency)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="Add Bank Account" onClose={() => { setShowCreate(false); reset(); }}
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button><Button form="create-bank-form" type="submit" isLoading={createMutation.isPending}>Add Account</Button></div>}
        >
          <form id="create-bank-form" className="space-y-4" onSubmit={handleSubmit((d) => createMutation.mutate(d))} noValidate>
            <Input label="Account Name" required placeholder="e.g. Operating Account" {...register('accountName')} />
            <Input label="Bank Name"    required placeholder="e.g. Westpac"          {...register('bankName')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Account Number" required {...register('accountNumber')} />
              <Input label="BSB / Sort Code"          {...register('bsb')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Currency" options={CURRENCIES} {...register('currency')} />
              <Input label="Opening Balance" type="number" step="0.01" {...register('currentBalance', { valueAsNumber: true })} />
            </div>
            {createMutation.isError && <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">Failed to add bank account.</p>}
          </form>
        </Modal>
      )}
    </div>
  );
}
