import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { KpiCard } from '../../components/shared/KpiCard';
import { Select } from '../../components/shared/Select';
import { apiGet } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { clsx } from 'clsx';

interface BankAccount { id: string; accountName: string; bankName: string; currentBalance: number; currency: string; }
interface StatementLine { id: string; transactionDate: string; description: string; amount: number; balance: number; reference?: string; isMatched: boolean; }
interface Statement { id: string; statementDate: string; openingBalance: number; closingBalance: number; status: string; lines: StatementLine[]; }

export function ReconciliationPage() {
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery<BankAccount[]>({
    queryKey: ['treasury-bank-accounts'],
    queryFn: () => apiGet('/treasury/bank-accounts'),
  });
  const { data: statements = [], isLoading: loadingStatements, isError } = useQuery<Statement[]>({
    queryKey: ['treasury-statements', selectedAccountId],
    queryFn: () => apiGet(`/treasury/bank-accounts/${selectedAccountId}/statements`),
    enabled: !!selectedAccountId,
  });

  const latestStatement = statements[0];
  const lines           = latestStatement?.lines ?? [];
  const matched         = lines.filter((l) => l.isMatched).length;
  const unmatched       = lines.length - matched;
  const pct             = lines.length > 0 ? Math.round((matched / lines.length) * 100) : 0;

  return (
    <div className="page">
      <PageHeader title="Bank Reconciliation" subtitle="Match transactions to bank statements" />

      {/* Account selector */}
      <div className="mb-6 max-w-sm">
        <Select
          label="Bank Account"
          options={accounts.map((a) => ({ value: a.id, label: `${a.accountName} — ${a.bankName}` }))}
          placeholder={loadingAccounts ? 'Loading…' : 'Select an account…'}
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
        />
      </div>

      {/* KPI strip — only shown when a statement is loaded */}
      {latestStatement && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Opening Balance"  value={formatCurrency(latestStatement.openingBalance)}  />
          <KpiCard label="Closing Balance"  value={formatCurrency(latestStatement.closingBalance)}  />
          <KpiCard label="Transactions"     value={lines.length} />
          <KpiCard label={`Matched (${pct}%)`} value={`${matched} / ${lines.length}`} accent={matched === lines.length ? 'success' : 'warning'} />
        </div>
      )}

      {/* No account selected */}
      {!selectedAccountId && (
        <div className="stat-card flex flex-col items-center gap-2 py-12 text-ink-400">
          <p className="text-[13px]">Select a bank account to view its reconciliation statement.</p>
        </div>
      )}

      {/* No statements */}
      {selectedAccountId && !loadingStatements && statements.length === 0 && (
        <div className="stat-card flex flex-col items-center gap-2 py-12 text-ink-400">
          <p className="text-[13px]">No statements imported for this account.</p>
          <p className="text-[12px]">Use the POST /treasury/bank-accounts/:id/statements endpoint to import.</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="stat-card flex items-center gap-2 py-8 text-danger text-[13px]">
          <AlertCircle className="w-4 h-4" />Could not load statements.
        </div>
      )}

      {/* Statement lines table */}
      {latestStatement && (
        <div className="rounded-card border border-border overflow-hidden bg-surface-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-50">
            <h3 className="text-[13px] font-semibold text-ink-900">
              Statement — {formatDate(latestStatement.statementDate)}
            </h3>
            {unmatched > 0 && (
              <span className="status-chip bg-warning-bg text-warning border border-warning-border">
                {unmatched} unmatched
              </span>
            )}
          </div>
          <table className="data-table">
            <thead><tr>
              <th>Date</th>
              <th>Description</th>
              <th>Reference</th>
              <th className="num">Amount</th>
              <th className="num">Balance</th>
              <th className="text-center w-24">Matched</th>
            </tr></thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className={line.isMatched ? 'bg-success-bg/40' : ''}>
                  <td className="text-[13px]">{formatDate(line.transactionDate)}</td>
                  <td className="text-[13px]">{line.description}</td>
                  <td className="text-[12px] text-ink-400 font-mono">{line.reference ?? '—'}</td>
                  <td className={clsx('num text-[13px] font-medium', line.amount < 0 ? 'text-danger' : 'text-success')}>
                    {formatCurrency(Math.abs(line.amount))}
                    <span className="text-ink-300 text-[10px] ml-1">{line.amount < 0 ? 'DR' : 'CR'}</span>
                  </td>
                  <td className="num text-[13px] tabular-nums">{formatCurrency(line.balance)}</td>
                  <td className="text-center">
                    {line.isMatched
                      ? <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                      : <Circle       className="w-4 h-4 text-ink-200 mx-auto" />}
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-[13px] text-ink-400">No transactions in this statement.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
