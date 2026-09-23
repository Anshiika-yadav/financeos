import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Search, Building2, AlertCircle } from 'lucide-react';
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
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuth } from '../../store/auth.context';
import { v4 as uuidv4 } from 'uuid';

interface Asset { id: string; assetNumber: string; name: string; category: string; acquisitionDate: string; acquisitionCost: number; residualValue: number; usefulLifeYears: number; depreciationMethod: string; accumulatedDepreciation: number; netBookValue: number; location?: string; status: string; }

const CATEGORIES = ['IT Equipment', 'Furniture & Fixtures', 'Motor Vehicles', 'Plant & Machinery', 'Leasehold Improvements', 'Land & Buildings', 'Intangible Assets', 'Other'];
const METHODS = [{ value: 'Straight Line', label: 'Straight Line' }, { value: 'Declining Balance', label: 'Declining Balance' }];

export function AssetsPage() {
  const { tenantContext } = useAuth() as any;
  const tenantId = tenantContext?.tenantId ?? '';
  const qc = useQueryClient();
  const [search, setSearch]         = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected]     = useState<Asset | null>(null);

  const { data: assets = [], isLoading, isError } = useQuery<Asset[]>({ queryKey: ['assets'], queryFn: () => apiGet('/assets') });
  const filtered = assets.filter((a) => {
    const q = search.toLowerCase();
    return !q || a.name.toLowerCase().includes(q) || a.assetNumber.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
  });

  const totalCost    = assets.reduce((s, a) => s + Number(a.acquisitionCost), 0);
  const totalNBV     = assets.reduce((s, a) => s + Number(a.netBookValue), 0);
  const totalDepr    = assets.reduce((s, a) => s + Number(a.accumulatedDepreciation), 0);

  const { register, handleSubmit, reset } = useForm({ defaultValues: { name: '', category: CATEGORIES[0], depreciationMethod: 'Straight Line', acquisitionDate: new Date().toISOString().split('T')[0], acquisitionCost: 0, residualValue: 0, usefulLifeYears: 5, location: '' } });
  const createMutation = useMutation({
    mutationFn: (d: unknown) => apiPost('/assets', d, { 'Idempotency-Key': uuidv4() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setShowCreate(false); reset(); },
  });

  const columns: Column<Asset>[] = [
    { key: 'assetNumber',  header: 'Asset #',   className: 'w-32', render: (r) => <span className="font-mono text-[13px] font-medium">{r.assetNumber}</span> },
    { key: 'name',         header: 'Asset Name', className: 'font-medium' },
    { key: 'category',     header: 'Category' },
    { key: 'acquisitionDate', header: 'Acquired', render: (r) => formatDate(r.acquisitionDate) },
    { key: 'acquisitionCost', header: 'Cost',    tdClassName: 'num', render: (r) => formatCurrency(r.acquisitionCost) },
    { key: 'accumulatedDepreciation', header: 'Accum. Depr.', tdClassName: 'num text-danger', render: (r) => formatCurrency(r.accumulatedDepreciation) },
    { key: 'netBookValue', header: 'Net Book Value', tdClassName: 'num font-semibold', render: (r) => formatCurrency(r.netBookValue) },
    { key: 'status',       header: 'Status',    render: (r) => <StatusBadge status={r.status as any} /> },
  ];

  if (isError) return <div className="page"><div className="flex flex-col items-center justify-center py-24 gap-3"><AlertCircle className="w-10 h-10 text-danger" /><p className="text-[15px] font-medium text-ink-700">Could not load assets</p></div></div>;

  return (
    <div className="page">
      <PageHeader title="Fixed Asset Register" subtitle={`${assets.length} assets`}
        actions={<><Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Export</Button><Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreate(true)}>Add Asset</Button></>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Assets"    value={assets.filter((a) => a.status === 'Active').length} />
        <KpiCard label="Total Cost"      value={formatCurrency(totalCost)}  accent="default" />
        <KpiCard label="Accum. Depreciation" value={formatCurrency(totalDepr)} accent="warning" />
        <KpiCard label="Net Book Value"  value={formatCurrency(totalNBV)}   accent="gold" />
      </div>
      <div className="mb-4">
        <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets…" className="field-input pl-9" /></div>
      </div>
      <DataTable columns={columns} data={filtered} keyField="id" isLoading={isLoading} isError={isError}
        onRowClick={setSelected} emptyMessage="No assets found." emptyIcon={<Building2 className="w-8 h-8" />} />

      {selected && (
        <DetailDrawer title={selected.name} subtitle={`${selected.assetNumber} · ${selected.category}`} onClose={() => setSelected(null)}
          tabs={[
            { id: 'details', label: 'Details', content: (
              <dl>{[
                { label: 'Asset Number',    value: selected.assetNumber },
                { label: 'Category',        value: selected.category },
                { label: 'Acquired',        value: formatDate(selected.acquisitionDate) },
                { label: 'Cost',            value: formatCurrency(selected.acquisitionCost) },
                { label: 'Residual Value',  value: formatCurrency(selected.residualValue) },
                { label: 'Useful Life',     value: `${selected.usefulLifeYears} years` },
                { label: 'Method',          value: selected.depreciationMethod },
                { label: 'Accum. Depr.',    value: <span className="text-danger">{formatCurrency(selected.accumulatedDepreciation)}</span> },
                { label: 'Net Book Value',  value: <span className="font-semibold">{formatCurrency(selected.netBookValue)}</span> },
                { label: 'Location',        value: selected.location ?? '—' },
                { label: 'Status',          value: <StatusBadge status={selected.status as any} /> },
              ].map(({ label, value }) => <div key={label} className="flex justify-between py-2.5 border-b border-border last:border-0"><dt className="text-[13px] text-ink-600">{label}</dt><dd className="text-[13px] text-ink-900 font-medium">{value}</dd></div>)}</dl>
            )},
            { id: 'audit', label: 'Audit Trail', content: <AuditTrailTab tenantId={tenantId} resourceType="asset" resourceId={selected.id} /> },
            { id: 'documents', label: 'Documents', content: <DocumentsTab /> },
          ]}
        />
      )}

      {showCreate && (
        <Modal title="Add Asset" size="lg" onClose={() => { setShowCreate(false); reset(); }}
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button><Button form="create-asset-form" type="submit" isLoading={createMutation.isPending}>Add Asset</Button></div>}
        >
          <form id="create-asset-form" className="space-y-4" onSubmit={handleSubmit((d) => createMutation.mutate(d))} noValidate>
            <Input label="Asset Name" required {...register('name')} />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Category" options={CATEGORIES.map((c) => ({ value: c, label: c }))} {...register('category')} />
              <Select label="Depreciation Method" options={METHODS} {...register('depreciationMethod')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Acquisition Date" type="date" required {...register('acquisitionDate')} />
              <Input label="Location" {...register('location')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Acquisition Cost" type="number" min="0" step="0.01" required {...register('acquisitionCost', { valueAsNumber: true })} />
              <Input label="Residual Value"   type="number" min="0" step="0.01" {...register('residualValue', { valueAsNumber: true })} />
              <Input label="Useful Life (yrs)" type="number" min="1" step="1" required {...register('usefulLifeYears', { valueAsNumber: true })} />
            </div>
            {createMutation.isError && <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">Failed to add asset.</p>}
          </form>
        </Modal>
      )}
    </div>
  );
}
