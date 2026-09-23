import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Landmark, TrendingUp, TrendingDown } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { apiGet } from '../../services/api';
import { formatCurrency } from '../../utils/format';

interface CashPosition {
  accounts: { id: string; accountName: string; bankName: string; accountNumber: string; currency: string; currentBalance: number }[];
  totalCash: number;
  pendingPayments: number;
  outstandingAR: number;
}

export function CashPositionPage() {
  const { data, isLoading } = useQuery<CashPosition>({ queryKey: ['cash-position'], queryFn: () => apiGet('/treasury/cash-position') });

  if (isLoading) return <div className="p-6"><div className="animate-pulse space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}</div></div>;

  const netCash = (data?.totalCash ?? 0) - (data?.pendingPayments ?? 0);

  return (
    <div className="p-6">
      <PageHeader title="Cash Position" subtitle="Real-time treasury overview" />

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-green-400">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Cash</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{formatCurrency(data?.totalCash ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Across all bank accounts</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-orange-400">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Pending Payments</p>
          <p className="text-3xl font-bold text-orange-600 mt-1">{formatCurrency(data?.pendingPayments ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Approved payment runs</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-400">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Outstanding AR</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{formatCurrency(data?.outstandingAR ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Receivable from customers</p>
        </div>
      </div>

      <div className="bg-brand-900 text-white rounded-lg p-5 mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-brand-200">Net Cash Position (after pending payments)</p>
          <p className="text-4xl font-bold mt-1">{formatCurrency(netCash)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-brand-200">Expected inflow (AR)</p>
          <p className="text-xl font-semibold text-green-300 flex items-center gap-1 justify-end">
            <TrendingUp className="w-4 h-4" />{formatCurrency(data?.outstandingAR ?? 0)}
          </p>
        </div>
      </div>

      <h2 className="text-base font-semibold text-gray-900 mb-4">Bank Accounts</h2>
      <div className="grid grid-cols-2 gap-4">
        {(data?.accounts ?? []).map(acc => (
          <div key={acc.id} className="bg-white rounded-lg shadow p-5 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg"><Landmark className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="font-semibold text-gray-900">{acc.accountName}</p>
                <p className="text-sm text-gray-500">{acc.bankName}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{acc.accountNumber}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase">{acc.currency}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{formatCurrency(acc.currentBalance, acc.currency)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
