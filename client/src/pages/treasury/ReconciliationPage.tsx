import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Circle } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { apiGet } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';

interface BankAccount { id: string; accountName: string; bankName: string; currentBalance: number; currency: string; }
interface StatementLine { id: string; transactionDate: string; description: string; amount: number; balance: number; reference?: string; isMatched: boolean; }
interface Statement { id: string; statementDate: string; openingBalance: number; closingBalance: number; status: string; lines: StatementLine[]; }

export function ReconciliationPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const { data: accounts = [] } = useQuery<BankAccount[]>({ queryKey: ['bank-accounts'], queryFn: () => apiGet('/treasury/bank-accounts') });
  const { data: statements = [] } = useQuery<Statement[]>({
    queryKey: ['statements', selectedAccountId],
    queryFn: () => apiGet(`/treasury/bank-accounts/${selectedAccountId}/statements`),
    enabled: !!selectedAccountId,
  });

  const latestStatement = statements[0];
  const lines = latestStatement?.lines ?? [];
  const matched = lines.filter(l => l.isMatched).length;

  return (
    <div className="p-6">
      <PageHeader title="Bank Reconciliation" subtitle="Match transactions to bank statements" />

      <div className="mb-6">
        <label className="text-sm font-medium text-gray-700 block mb-2">Select Bank Account</label>
        <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">Choose account…</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.accountName} — {a.bankName}</option>)}
        </select>
      </div>

      {selectedAccountId && latestStatement && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Opening Balance', value: formatCurrency(latestStatement.openingBalance) },
              { label: 'Closing Balance', value: formatCurrency(latestStatement.closingBalance) },
              { label: 'Transactions', value: lines.length },
              { label: 'Matched', value: `${matched} / ${lines.length}`, highlight: matched === lines.length },
            ].map(c => (
              <div key={c.label} className={`bg-white rounded-lg shadow p-4 ${c.highlight ? 'border border-green-300' : ''}`}>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
                <p className={`text-2xl font-bold mt-1 ${c.highlight ? 'text-green-600' : 'text-gray-900'}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">Statement Lines — {formatDate(latestStatement.statementDate)}</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500">Description</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-500">Amount</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-500">Balance</th>
                  <th className="px-4 py-2 text-center text-xs text-gray-500">Matched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map(line => (
                  <tr key={line.id} className={line.isMatched ? 'bg-green-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-2 text-sm text-gray-600">{formatDate(line.transactionDate)}</td>
                    <td className="px-4 py-2 text-sm text-gray-800">{line.description}</td>
                    <td className={`px-4 py-2 text-sm text-right font-medium ${line.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(Math.abs(line.amount))}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-700">{formatCurrency(line.balance)}</td>
                    <td className="px-4 py-2 text-center">
                      {line.isMatched ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <Circle className="w-4 h-4 text-gray-300 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedAccountId && statements.length === 0 && (
        <div className="bg-white rounded-lg shadow p-10 text-center text-gray-400 text-sm">No statements imported for this account yet.</div>
      )}
    </div>
  );
}
