import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { apiGet } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';

interface Project {
  id: string; projectCode: string; name: string;
  startDate: string; endDate?: string; status: string;
  budget: number; actualCost: number; billedAmount: number; currency: string;
}

export function ProjectsPage() {
  const { data: projects = [], isLoading } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: () => apiGet('/projects') });
  const { data: contracts = [] } = useQuery<{ id: string; contractNumber: string; title: string; counterparty: string; value: number; status: string; endDate?: string }[]>({ queryKey: ['contracts'], queryFn: () => apiGet('/projects/contracts/list') });

  const totalBudget = projects.reduce((s, p) => s + Number(p.budget), 0);
  const totalActual = projects.reduce((s, p) => s + Number(p.actualCost), 0);

  const columns: Column<Project>[] = [
    { key: 'projectCode', header: 'Code', className: 'font-mono font-medium' },
    { key: 'name', header: 'Project Name', className: 'font-medium' },
    { key: 'startDate', header: 'Start', render: r => formatDate(r.startDate) },
    { key: 'endDate', header: 'End', render: r => r.endDate ? formatDate(r.endDate) : 'Ongoing' },
    { key: 'budget', header: 'Budget', render: r => formatCurrency(r.budget, r.currency), className: 'text-right' },
    { key: 'actualCost', header: 'Actual Cost', render: r => (
      <span className={Number(r.actualCost) > Number(r.budget) ? 'text-red-600 font-medium' : 'text-gray-700'}>{formatCurrency(r.actualCost, r.currency)}</span>
    ), className: 'text-right' },
    { key: 'progress', header: 'Budget Used', render: r => {
      const pct = r.budget > 0 ? Math.min(Math.round((r.actualCost / r.budget) * 100), 100) : 0;
      return (
        <div className="flex items-center gap-2">
          <div className="w-20 bg-gray-200 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-orange-400' : 'bg-green-500'}`} style={{ width: `${pct}%` }} /></div>
          <span className="text-xs text-gray-500">{pct}%</span>
        </div>
      );
    }},
    { key: 'status', header: 'Status', render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{r.status}</span> },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Project Finance" subtitle={`${projects.length} active projects`} />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500 uppercase">Total Budget</p><p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalBudget)}</p></div>
        <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500 uppercase">Total Actual Cost</p><p className={`text-2xl font-bold mt-1 ${totalActual > totalBudget ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(totalActual)}</p></div>
        <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500 uppercase">Budget Remaining</p><p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(totalBudget - totalActual)}</p></div>
      </div>

      <DataTable columns={columns} data={projects} keyField="id" isLoading={isLoading} />

      <div className="mt-8">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Contracts</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
              <th className="px-4 py-2 text-left text-xs text-gray-500">Contract #</th>
              <th className="px-4 py-2 text-left text-xs text-gray-500">Title</th>
              <th className="px-4 py-2 text-left text-xs text-gray-500">Counterparty</th>
              <th className="px-4 py-2 text-right text-xs text-gray-500">Value</th>
              <th className="px-4 py-2 text-left text-xs text-gray-500">Expires</th>
              <th className="px-4 py-2 text-left text-xs text-gray-500">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {contracts.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-mono">{c.contractNumber}</td>
                  <td className="px-4 py-2 text-sm font-medium">{c.title}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{c.counterparty}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(c.value)}</td>
                  <td className="px-4 py-2 text-sm">{c.endDate ? formatDate(c.endDate) : 'Open-ended'}</td>
                  <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
