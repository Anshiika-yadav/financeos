import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, Column } from '../../components/shared/DataTable';
import { apiGet } from '../../services/api';
import { formatCurrency, formatNumber } from '../../utils/format';

interface InventoryItem {
  id: string; sku: string; name: string; category?: string; unit: string;
  unitCost: number; quantityOnHand: number; reorderPoint: number;
  warehouseLocation?: string; isActive: boolean;
}

export function InventoryPage() {
  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({ queryKey: ['inventory-items'], queryFn: () => apiGet('/inventory/items') });
  const { data: movements = [] } = useQuery<{ id: string; movementType: string; quantity: number; unitCost: number; movementDate: string; item: { name: string; sku: string } }[]>({
    queryKey: ['stock-movements'], queryFn: () => apiGet('/inventory/movements'),
  });

  const lowStock = items.filter(i => Number(i.quantityOnHand) <= Number(i.reorderPoint));
  const totalValue = items.reduce((s, i) => s + Number(i.quantityOnHand) * Number(i.unitCost), 0);

  const columns: Column<InventoryItem>[] = [
    { key: 'sku', header: 'SKU', className: 'font-mono' },
    { key: 'name', header: 'Item Name', className: 'font-medium' },
    { key: 'category', header: 'Category', render: r => r.category ?? '—' },
    { key: 'quantityOnHand', header: 'On Hand', render: r => (
      <span className={`flex items-center gap-1 ${Number(r.quantityOnHand) <= Number(r.reorderPoint) ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
        {Number(r.quantityOnHand) <= Number(r.reorderPoint) && <AlertTriangle className="w-3 h-3" />}
        {formatNumber(Number(r.quantityOnHand))} {r.unit}
      </span>
    )},
    { key: 'reorderPoint', header: 'Reorder Point', render: r => `${formatNumber(Number(r.reorderPoint))} ${r.unit}` },
    { key: 'unitCost', header: 'Unit Cost', render: r => formatCurrency(Number(r.unitCost)), className: 'text-right' },
    { key: 'value', header: 'Total Value', render: r => formatCurrency(Number(r.quantityOnHand) * Number(r.unitCost)), className: 'text-right font-medium' },
    { key: 'warehouseLocation', header: 'Location', render: r => r.warehouseLocation ?? '—' },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Inventory & Costing" subtitle={`${items.length} items`} />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500 uppercase">Total SKUs</p><p className="text-2xl font-bold text-gray-900 mt-1">{items.length}</p></div>
        <div className={`bg-white rounded-lg shadow p-4 ${lowStock.length > 0 ? 'border border-orange-300' : ''}`}>
          <p className="text-xs text-gray-500 uppercase">Low Stock Alerts</p>
          <p className={`text-2xl font-bold mt-1 ${lowStock.length > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{lowStock.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-blue-200"><p className="text-xs text-gray-500 uppercase">Total Inventory Value</p><p className="text-2xl font-bold text-blue-700 mt-1">{formatCurrency(totalValue)}</p></div>
      </div>

      <DataTable columns={columns} data={items} keyField="id" isLoading={isLoading} />

      <div className="mt-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Recent Stock Movements</h3>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
              <th className="px-4 py-2 text-left text-xs text-gray-500">Item</th>
              <th className="px-4 py-2 text-left text-xs text-gray-500">Type</th>
              <th className="px-4 py-2 text-right text-xs text-gray-500">Qty</th>
              <th className="px-4 py-2 text-right text-xs text-gray-500">Unit Cost</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {movements.slice(0, 10).map(m => (
                <tr key={m.id}>
                  <td className="px-4 py-2 text-sm">{m.item?.name} <span className="text-gray-400 text-xs">{m.item?.sku}</span></td>
                  <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.movementType === 'Receipt' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{m.movementType}</span></td>
                  <td className="px-4 py-2 text-sm text-right font-medium">{formatNumber(m.quantity)}</td>
                  <td className="px-4 py-2 text-sm text-right">{formatCurrency(m.unitCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
