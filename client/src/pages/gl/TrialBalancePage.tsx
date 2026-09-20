import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, AlertCircle, Scale, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { KpiCard } from '../../components/shared/KpiCard';
import { Button } from '../../components/shared/Button';
import { apiGet } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { clsx } from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrialBalanceLine {
  id: string;
  code: string;
  name: string;
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  isActive: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const;

const TYPE_META: Record<string, { heading: string; color: string }> = {
  Asset:     { heading: 'Assets',       color: 'text-info' },
  Liability: { heading: 'Liabilities',  color: 'text-danger' },
  Equity:    { heading: 'Equity',       color: 'text-[#6D28D9]' },
  Revenue:   { heading: 'Revenue',      color: 'text-success' },
  Expense:   { heading: 'Expenses',     color: 'text-warning' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TrialBalancePage() {
  const [showZeroBalance, setShowZeroBalance] = useState(false);

  const { data: raw = [], isLoading, isError } = useQuery<TrialBalanceLine[]>({
    queryKey: ['gl-trial-balance'],
    queryFn: () => apiGet('/gl/trial-balance'),
  });

  const lines = showZeroBalance ? raw : raw.filter((l) => l.totalDebit !== 0 || l.totalCredit !== 0);

  const totalDebit  = lines.reduce((s, l) => s + l.totalDebit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.totalCredit, 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;
  const diff        = Math.abs(totalDebit - totalCredit);

  if (isError) {
    return (
      <div className="page">
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <AlertCircle className="w-10 h-10 text-danger" />
          <p className="text-[15px] font-medium text-ink-700">Could not load Trial Balance</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Trial Balance"
        subtitle="Posted transactions only — as of today"
        actions={
          <>
            <label className="flex items-center gap-2 text-[13px] text-ink-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showZeroBalance}
                onChange={(e) => setShowZeroBalance(e.target.checked)}
                className="rounded border-border text-gold-500 focus:ring-gold-500"
              />
              Show zero balances
            </label>
            <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>
              Export
            </Button>
          </>
        }
      />

      {/* ── Balance status banner ── */}
      {!isLoading && (
        <div className={clsx(
          'flex items-center gap-3 rounded-card px-4 py-3 mb-6 border text-[13px] font-medium',
          isBalanced
            ? 'bg-success-bg border-success-border text-success'
            : 'bg-danger-bg border-danger-border text-danger',
        )}>
          {isBalanced
            ? <><CheckCircle2 className="w-4 h-4" /> Trial balance is balanced</>
            : <><AlertCircle className="w-4 h-4" /> Out of balance by {formatCurrency(diff)} — investigate before period close</>
          }
        </div>
      )}

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Debit"  value={formatCurrency(totalDebit)}  accent="info" />
        <KpiCard label="Total Credit" value={formatCurrency(totalCredit)} accent="success" />
        <KpiCard label="Difference"   value={formatCurrency(diff)}        accent={isBalanced ? 'success' : 'danger'} />
        <KpiCard label="Accounts"     value={lines.length} />
      </div>

      {/* ── Table ── */}
      <div className="rounded-card border border-border overflow-hidden bg-surface-0">
        {isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-4 bg-surface-100 rounded" />
            ))}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-24">Code</th>
                <th>Account</th>
                <th className="num w-36">Debit</th>
                <th className="num w-36">Credit</th>
                <th className="num w-36">Balance</th>
              </tr>
            </thead>
            <tbody>
              {TYPE_ORDER.map((type) => {
                const group = lines.filter((l) => l.accountType === type);
                if (group.length === 0) return null;

                const groupDebit  = group.reduce((s, l) => s + l.totalDebit, 0);
                const groupCredit = group.reduce((s, l) => s + l.totalCredit, 0);
                const { heading, color } = TYPE_META[type];

                return (
                  <React.Fragment key={type}>
                    {/* Section header */}
                    <tr className="bg-surface-50">
                      <td colSpan={5} className={clsx('py-2 px-4 text-[11px] font-bold uppercase tracking-widest', color)}>
                        {heading}
                      </td>
                    </tr>

                    {/* Account rows */}
                    {group.map((l) => (
                      <tr key={l.id}>
                        <td className="font-mono text-[12px] text-ink-600">{l.code}</td>
                        <td>{l.name}</td>
                        <td className="num text-[13px]">{l.totalDebit > 0 ? formatCurrency(l.totalDebit) : <span className="text-ink-200">—</span>}</td>
                        <td className="num text-[13px]">{l.totalCredit > 0 ? formatCurrency(l.totalCredit) : <span className="text-ink-200">—</span>}</td>
                        <td className="num text-[13px] font-medium">{formatCurrency(Math.abs(l.balance))}</td>
                      </tr>
                    ))}

                    {/* Section subtotal */}
                    <tr className="bg-surface-50 border-t border-border">
                      <td colSpan={2} className={clsx('text-[11px] font-semibold uppercase tracking-wide py-2', color)}>
                        Total {heading}
                      </td>
                      <td className="num text-[13px] font-semibold">{formatCurrency(groupDebit)}</td>
                      <td className="num text-[13px] font-semibold">{formatCurrency(groupCredit)}</td>
                      <td className="num text-[13px] font-semibold">{formatCurrency(Math.abs(groupDebit - groupCredit))}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* Grand total */}
            <tfoot>
              <tr className="bg-navy-950 text-white">
                <td colSpan={2} className="px-4 py-3 text-[13px] font-bold uppercase tracking-wide">
                  Grand Total
                </td>
                <td className="num px-4 py-3 text-[13px] font-bold tabular-nums">{formatCurrency(totalDebit)}</td>
                <td className="num px-4 py-3 text-[13px] font-bold tabular-nums">{formatCurrency(totalCredit)}</td>
                <td className={clsx('num px-4 py-3 text-[13px] font-bold tabular-nums', isBalanced ? 'text-green-300' : 'text-red-300')}>
                  {isBalanced ? '—' : formatCurrency(diff)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
