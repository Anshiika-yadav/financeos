import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Search, AlertTriangle, Package, AlertCircle } from 'lucide-react';
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
import { formatCurrency, formatNumber, formatDate } from '../../utils/format';
import { useAuth } from '../../store/auth.context';
import { clsx } from 'clsx';
import { v4 as uuidv4 } from 'uuid';

interface InventoryItem { id: string; sku: string; name: string; category?: string; unit: string; unitCost: number; quantityOnHand: number; reorderPoint: number; warehouseLocation?: string; isActive: boolean; }
interface StockMovement { id: string; movementType: string; quantity: number; unitCost: number; totalCost: number; movementDate: string; reference?: string; item: { name: string; sku: string }; }

const MOVEMENT_TYPES = [{ value: 'Receipt', label: 'Receipt (in)' }, { value: 'Issue', label: 'Issue (out)' }, { value: 'Adjustment', label: 'Adjustment' }, { value: 'Transfer', label: 'Transfer' }];

export function InventoryPage() {
  const { tenantContext } = useAuth() as any;
  const tenantId = tenantContext?.tenantId ?? '';
  const qc = useQueryClient();
  const [search, setSearch]           = useState('');
  const [showCreateItem, setShowCreateItem] = useState(false);
  const [showMovement, setShowMovement]     = useState(false);
  const [selected, setSelected]             = useState<InventoryItem | null>(null);
  const [tab, setTab]                       = useState<'items' | 'movements'>('items');

  const { data: items = [], isLoading: loadItems, isError } = useQuery<InventoryItem[]>({ queryKey: ['inventory-items'], queryFn: () => apiGet('/inventory/items') });
  const { data: movements = [], isLoading: loadMovements }  = useQuery<StockMovement[]>({ queryKey: ['inventory-movements'], queryFn: () => apiGet('/inventory/movements'), enabled: tab === 'movements' });

  const filtered = items.filter((i) => {
    const q = search.toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q);
  });

  const totalValue = items.reduce((s, i) => s + Number(i.quantityOnHand) * Number(i.unitCost), 0);
  const lowStock   = items.filter((i) => Number(i.quantityOnHand) <= Number(i.reorderPoint));

  const { register: ri, handleSubmit: hsi, reset: resi } = useForm({ defaultValues: { sku: '', name: '', category: '', unit: 'Each', costMethod: 'FIFO', unitCost: 0, reorderPoint: 0, warehouseLocation: '' } });
  const { register: rm, handleSubmit: hsm, reset: resm } = useForm({ defaultValues: { itemId: '', movementType: 'Receipt', quantity: 1, unitCost: 0, reference: '', movementDate: new Date().toISOString().split('T')[0] } });

  const createItemMutation = useMutation({ mutationFn: (d: unknown) => apiPost('/inventory/items', d, { 'Idempotency-Key': uuidv4() }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-items'] }); setShowCreateItem(false); resi(); } });
  const createMoveMutation = useMutation({ mutationFn: (d: unknown) => apiPost('/inventory/movements', d, { 'Idempotency-Key': uuidv4() }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-items', 'inventory-movements'] }); setShowMovement(false); resm(); } });

  const itemCols: Column<InventoryItem>[] = [
    { key: 'sku',            header: 'SKU',           className: 'w-28 font-mono' },
    { key: 'name',           header: 'Item Name',     render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'category',       header: 'Category',      render: (r) => r.category ?? <span className="text-ink-300">—</span> },
    { key: 'quantityOnHand', header: 'On Hand',
      render: (r) => {
        const low = Number(r.quantityOnHand) <= Number(r.reorderPoint);
        return <span className={clsx('flex items-center gap-1 font-medium', low ? 'text-danger' : 'text-ink-900')}>
          {low && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
          {formatNumber(Number(r.quantityOnHand))} {r.unit}
        </span>;
      },
    },
    { key: 'reorderPoint',   header: 'Reorder At',    render: (r) => `${formatNumber(Number(r.reorderPoint))} ${r.unit}` },
    { key: 'unitCost',       header: 'Unit Cost',     tdClassName: 'num', render: (r) => formatCurrency(Number(r.unitCost)) },
    { key: 'totalValue',     header: 'Total Value',   tdClassName: 'num font-semibold', render: (r) => formatCurrency(Number(r.quantityOnHand) * Number(r.unitCost)) },
    { key: 'warehouseLocation', header: 'Location',   render: (r) => r.warehouseLocation ?? <span className="text-ink-300">—</span> },
  ];

  const moveCols: Column<StockMovement>[] = [
    { key: 'item',         header: 'Item',          render: (r) => <><span className="font-medium">{r.item?.name}</span> <span className="text-ink-400 font-mono text-[12px]">{r.item?.sku}</span></> },
    { key: 'movementType', header: 'Type',          render: (r) => <span className={clsx('status-chip', r.movementType === 'Receipt' ? 'bg-success-bg text-success border-success-border' : 'bg-info-bg text-info border-info-border')}>{r.movementType}</span> },
    { key: 'quantity',     header: 'Qty',           tdClassName: 'num', render: (r) => formatNumber(r.quantity) },
    { key: 'unitCost',     header: 'Unit Cost',     tdClassName: 'num', render: (r) => formatCurrency(r.unitCost) },
    { key: 'totalCost',    header: 'Total Cost',    tdClassName: 'num font-medium', render: (r) => formatCurrency(r.totalCost) },
    { key: 'movementDate', header: 'Date',          render: (r) => formatDate(r.movementDate) },
    { key: 'reference',    header: 'Reference',     render: (r) => r.reference ?? <span className="text-ink-300">—</span> },
  ];

  if (isError) return <div className="page"><div className="flex flex-col items-center justify-center py-24 gap-3"><AlertCircle className="w-10 h-10 text-danger" /><p className="text-[15px] font-medium text-ink-700">Could not load inventory</p></div></div>;

  return (
    <div className="page">
      <PageHeader title="Inventory & Costing" subtitle={`${items.length} SKUs`}
        actions={<>
          <Button variant="secondary" size="sm" onClick={() => setShowMovement(true)}>Record Movement</Button>
          <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Export</Button>
          <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreateItem(true)}>Add Item</Button>
        </>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total SKUs"      value={items.length} />
        <KpiCard label="Inventory Value" value={formatCurrency(totalValue)} accent="gold" />
        <KpiCard label="Low Stock Alerts" value={lowStock.length} accent={lowStock.length > 0 ? 'danger' : 'default'} />
        <KpiCard label="Active Items"    value={items.filter((i) => i.isActive).length} accent="success" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4">
        {(['items', 'movements'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={clsx('px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px capitalize', tab === t ? 'border-gold-500 text-ink-900' : 'border-transparent text-ink-600 hover:text-ink-900')}>
            {t === 'items' ? 'Items' : 'Stock Movements'}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <>
          <div className="mb-4">
            <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" className="field-input pl-9" /></div>
          </div>
          <DataTable columns={itemCols} data={filtered} keyField="id" isLoading={loadItems} onRowClick={setSelected} emptyMessage="No inventory items." emptyIcon={<Package className="w-8 h-8" />} />
        </>
      )}
      {tab === 'movements' && (
        <DataTable columns={moveCols} data={movements} keyField="id" isLoading={loadMovements} emptyMessage="No stock movements recorded." emptyIcon={<Package className="w-8 h-8" />} />
      )}

      {selected && (
        <DetailDrawer title={selected.name} subtitle={`SKU: ${selected.sku}`} onClose={() => setSelected(null)}
          tabs={[
            { id: 'details', label: 'Details', content: (
              <dl>{[
                { label: 'SKU',            value: selected.sku },
                { label: 'Category',       value: selected.category ?? '—' },
                { label: 'Unit',           value: selected.unit },
                { label: 'Cost Method',    value: 'FIFO' },
                { label: 'Unit Cost',      value: formatCurrency(Number(selected.unitCost)) },
                { label: 'On Hand',        value: `${formatNumber(Number(selected.quantityOnHand))} ${selected.unit}` },
                { label: 'Reorder Point',  value: `${formatNumber(Number(selected.reorderPoint))} ${selected.unit}` },
                { label: 'Total Value',    value: <span className="font-semibold">{formatCurrency(Number(selected.quantityOnHand) * Number(selected.unitCost))}</span> },
                { label: 'Location',       value: selected.warehouseLocation ?? '—' },
              ].map(({ label, value }) => <div key={label} className="flex justify-between py-2.5 border-b border-border last:border-0"><dt className="text-[13px] text-ink-600">{label}</dt><dd className="text-[13px] text-ink-900 font-medium">{value}</dd></div>)}</dl>
            )},
            { id: 'audit', label: 'Audit Trail', content: <AuditTrailTab tenantId={tenantId} resourceType="inventory" resourceId={selected.id} /> },
            { id: 'documents', label: 'Documents', content: <DocumentsTab /> },
          ]}
        />
      )}

      {showCreateItem && (
        <Modal title="Add Inventory Item" onClose={() => { setShowCreateItem(false); resi(); }}
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setShowCreateItem(false); resi(); }}>Cancel</Button><Button form="create-item-form" type="submit" isLoading={createItemMutation.isPending}>Add Item</Button></div>}
        >
          <form id="create-item-form" className="space-y-4" onSubmit={hsi((d) => createItemMutation.mutate(d))} noValidate>
            <div className="grid grid-cols-2 gap-4">
              <Input label="SKU" required {...ri('sku')} />
              <Input label="Item Name" required {...ri('name')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Category"          {...ri('category')} />
              <Input label="Unit (e.g. Each)"  {...ri('unit')} />
              <Input label="Warehouse Location" {...ri('warehouseLocation')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Unit Cost"      type="number" min="0" step="0.01" required {...ri('unitCost',      { valueAsNumber: true })} />
              <Input label="Reorder Point"  type="number" min="0"              {...ri('reorderPoint',  { valueAsNumber: true })} />
            </div>
            {createItemMutation.isError && <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">Failed to add item.</p>}
          </form>
        </Modal>
      )}

      {showMovement && (
        <Modal title="Record Stock Movement" onClose={() => { setShowMovement(false); resm(); }}
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setShowMovement(false); resm(); }}>Cancel</Button><Button form="create-move-form" type="submit" isLoading={createMoveMutation.isPending}>Record</Button></div>}
        >
          <form id="create-move-form" className="space-y-4" onSubmit={hsm((d) => createMoveMutation.mutate(d))} noValidate>
            <Select label="Item" required options={items.map((i) => ({ value: i.id, label: `${i.sku} — ${i.name}` }))} placeholder="Select item…" {...rm('itemId')} />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Movement Type" options={MOVEMENT_TYPES} {...rm('movementType')} />
              <Input label="Movement Date" type="date" required {...rm('movementDate')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Quantity"  type="number" step="1"    required {...rm('quantity',  { valueAsNumber: true })} />
              <Input label="Unit Cost" type="number" step="0.01" required {...rm('unitCost',  { valueAsNumber: true })} />
            </div>
            <Input label="Reference / Notes" {...rm('reference')} />
            {createMoveMutation.isError && <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">Failed to record movement.</p>}
          </form>
        </Modal>
      )}
    </div>
  );
}
