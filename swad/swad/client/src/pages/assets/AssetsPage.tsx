import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { apiGet } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';

interface Asset {
  id: string; assetNumber: string; name: string; category: string;
  acquisitionDate: string; acquisitionCost: number;
  netBookValue: number; accumulatedDepreciation: number;
  usefulLifeYears: number; depreciationMethod: string;
  location?: string; status: string;
}

export function AssetsPage() {
  const { data: assets = [], isLoading } = useQuery<Asset[]>({ queryKey: ['assets'], queryFn: () => apiGet('/assets') });
  const { data: deprRuns = [] } = useQuery<{ id: string; runDate: string; periodName: string; totalAmount: number; status: string }[]>({ queryKey: ['depreciation-runs'], queryFn: () => apiGet('/assets/depreciation/runs') });

  const totalCost = assets.reduce((s, a) => s + a.acquisitionCost, 0);
  const totalNBV = assets.reduce((s, a) => s + a.netBookValue, 0);
  const totalAccumDepr = assets.reduce((s, a) => s + a.accumulatedDepreciation, 0);

  const columns: Column<Asset>[] = [
    { key: 'assetNumber', header: 'Asset #', className: 'font-mono font-medium' },
    { key: 'name', header: 'Asset Name', className: 'max-w-xs' },
    { key: 'category', header: 'Category' },
    { key: 'acquisitionDate', header: 'Acquired', render: r => formatDate(r.acquisitionDate) },
    { key: 'acquisitionCost', header: 'Cost', render: r => formatCurrency(r.acquisitionCost), className: 'text-right' },
    { key: 'accumulatedDepreciation', header: 'Accum. Depr', render: r => formatCurrency(r.accumulatedDepreciation), className: 'text-right text-red-600' },
    { key: 'netBookValue', header: 'Net Book Value', render: r => formatCurrency(r.netBookValue), className: 'text-right font-semibold' },
    { key: 'status', header: 'Status', render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{r.status}</span> },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Fixed Asset Register" subtitle={`${assets.length} assets`} />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500 uppercase">Total Cost</p><p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalCost)}</p></div>
        <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500 uppercase">Accumulated Depreciation</p><p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalAccumDepr)}</p></div>
        <div className="bg-white rounded-lg shadow p-4 border border-green-200"><p className="text-xs text-gray-500 uppercase">Net Book Value</p><p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(totalNBV)}</p></div>
      </div>

      <DataTable columns={columns} data={assets} keyField="id" isLoading={isLoading} />

      {deprRuns.length > 0 && (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Recent Depreciation Runs</h3>
          <div className="bg-white rounded-lg shadow divide-y">
            {deprRuns.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div><p className="text-sm font-medium text-gray-800">{r.periodName}</p><p className="text-xs text-gray-400">{formatDate(r.runDate)}</p></div>
                <div className="text-right"><p className="text-sm font-semibold text-gray-900">{formatCurrency(r.totalAmount)}</p><span className="text-xs text-green-600">{r.status}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
