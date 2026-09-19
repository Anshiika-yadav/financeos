import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/shared/Button';
import { apiGet } from '../../services/api';
import { formatCurrency } from '../../utils/format';

interface TrialBalanceLine {
  id: string; code: string; name: string; accountType: string;
  totalDebit: number; totalCredit: number; balance: number;
}

const TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
const TYPE_COLORS: Record<string, string> = {
  Asset: 'text-blue-700', Liability: 'text-red-700',
  Equity: 'text-purple-700', Revenue: 'text-green-700', Expense: 'text-orange-700',
};

export function TrialBalancePage() {
  const { data: lines = [], isLoading } = useQuery<TrialBalanceLine[]>({
    queryKey: ['trial-balance'],
    queryFn: () => apiGet('/gl/trial-balance'),
  });

  const totalDebit = lines.reduce((s, l) => s + l.totalDebit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.totalCredit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="p-6">
      <PageHeader title="Trial Balance" subtitle="Posted transactions only"
        actions={<Button variant="secondary"><Download className="w-4 h-4 mr-1" />Export</Button>} />

      {!isLoading && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${isBalanced ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {isBalanced ? '✓ Trial balance is balanced' : `⚠ Out of balance by ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
              ))
            ) : (
              TYPE_ORDER.map(type => {
                const group = lines.filter(l => l.accountType === type);
                if (group.length === 0) return null;
                const groupDebit = group.reduce((s, l) => s + l.totalDebit, 0);
                const groupCredit = group.reduce((s, l) => s + l.totalCredit, 0);
                return (
                  <React.Fragment key={type}>
                    <tr className="bg-gray-50">
                      <td colSpan={5} className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider ${TYPE_COLORS[type]}`}>{type}</td>
                    </tr>
                    {group.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-mono text-gray-500">{l.code}</td>
                        <td className="px-4 py-2 text-sm text-gray-800">{l.name}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-700">{l.totalDebit > 0 ? formatCurrency(l.totalDebit) : '—'}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-700">{l.totalCredit > 0 ? formatCurrency(l.totalCredit) : '—'}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(Math.abs(l.balance))}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 border-t border-gray-200">
                      <td colSpan={2} className={`px-4 py-2 text-xs font-semibold ${TYPE_COLORS[type]}`}>Total {type}</td>
                      <td className="px-4 py-2 text-xs font-semibold text-right">{formatCurrency(groupDebit)}</td>
                      <td className="px-4 py-2 text-xs font-semibold text-right">{formatCurrency(groupCredit)}</td>
                      <td className="px-4 py-2 text-xs font-semibold text-right">{formatCurrency(Math.abs(groupDebit - groupCredit))}</td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          <tfoot className="bg-gray-900 text-white">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-sm font-bold">TOTAL</td>
              <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(totalDebit)}</td>
              <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(totalCredit)}</td>
              <td className="px-4 py-3 text-sm font-bold text-right">{isBalanced ? '—' : formatCurrency(Math.abs(totalDebit - totalCredit))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
