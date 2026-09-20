import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, FolderKanban, AlertCircle } from 'lucide-react';
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
import { clsx } from 'clsx';
import { v4 as uuidv4 } from 'uuid';

interface Project { id: string; projectCode: string; name: string; startDate: string; endDate?: string; status: string; budget: number; actualCost: number; billedAmount: number; currency: string; }
interface Contract { id: string; contractNumber: string; title: string; counterparty: string; contractType: string; value: number; currency: string; status: string; startDate: string; endDate?: string; }

const CONTRACT_TYPES = [{ value: 'Customer', label: 'Customer' }, { value: 'Supplier', label: 'Supplier' }, { value: 'Lease', label: 'Lease' }, { value: 'Employment', label: 'Employment' }];
const CURRENCIES = [{ value: 'USD', label: 'USD' }, { value: 'AUD', label: 'AUD' }, { value: 'GBP', label: 'GBP' }, { value: 'EUR', label: 'EUR' }];

export function ProjectsPage() {
  const { tenantContext } = useAuth() as any;
  const tenantId = tenantContext?.tenantId ?? '';
  const qc = useQueryClient();
  const [tab, setTab]               = useState<'projects' | 'contracts'>('projects');
  const [showCreateP, setShowCreateP] = useState(false);
  const [showCreateC, setShowCreateC] = useState(false);
  const [selected, setSelected]       = useState<Project | null>(null);

  const { data: projects = [], isLoading: loadP, isError } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: () => apiGet('/projects') });
  const { data: contracts = [], isLoading: loadC }          = useQuery<Contract[]>({ queryKey: ['contracts'], queryFn: () => apiGet('/projects/contracts/list'), enabled: tab === 'contracts' });

  const totalBudget = projects.reduce((s, p) => s + Number(p.budget), 0);
  const totalActual = projects.reduce((s, p) => s + Number(p.actualCost), 0);
  const overBudget  = projects.filter((p) => Number(p.actualCost) > Number(p.budget)).length;

  const { register: rp, handleSubmit: hsp, reset: resp } = useForm({ defaultValues: { name: '', startDate: new Date().toISOString().split('T')[0], endDate: '', budget: 0, currency: 'USD', description: '' } });
  const { register: rc, handleSubmit: hsc, reset: resc } = useForm({ defaultValues: { title: '', counterparty: '', contractType: 'Customer', startDate: new Date().toISOString().split('T')[0], endDate: '', value: 0, currency: 'USD' } });

  const createProjectMutation  = useMutation({ mutationFn: (d: unknown) => apiPost('/projects', d, { 'Idempotency-Key': uuidv4() }),          onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowCreateP(false); resp(); } });
  const createContractMutation = useMutation({ mutationFn: (d: unknown) => apiPost('/projects/contracts', d, { 'Idempotency-Key': uuidv4() }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); setShowCreateC(false); resc(); } });

  const budgetPct = (p: Project) => Number(p.budget) > 0 ? Math.min(Math.round((Number(p.actualCost) / Number(p.budget)) * 100), 100) : 0;

  const projectCols: Column<Project>[] = [
    { key: 'projectCode', header: 'Code',    className: 'w-28 font-mono' },
    { key: 'name',        header: 'Project', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'startDate',   header: 'Start',   render: (r) => formatDate(r.startDate) },
    { key: 'endDate',     header: 'End',     render: (r) => r.endDate ? formatDate(r.endDate) : <span className="text-ink-300">Ongoing</span> },
    { key: 'budget',      header: 'Budget',  tdClassName: 'num', render: (r) => formatCurrency(r.budget, r.currency) },
    { key: 'actualCost',  header: 'Actual',  tdClassName: 'num',
      render: (r) => <span className={Number(r.actualCost) > Number(r.budget) ? 'text-danger font-semibold' : ''}>{formatCurrency(r.actualCost, r.currency)}</span>
    },
    { key: 'progress', header: 'Budget Used',
      render: (r) => {
        const pct = budgetPct(r);
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="flex-1 bg-surface-100 rounded-full h-1.5">
              <div className={clsx('h-1.5 rounded-full', pct > 90 ? 'bg-danger' : pct > 70 ? 'bg-warning' : 'bg-success')} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] text-ink-400 w-8 text-right tabular-nums">{pct}%</span>
          </div>
        );
      },
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status as any} /> },
  ];

  const contractCols: Column<Contract>[] = [
    { key: 'contractNumber', header: 'Contract #', className: 'w-28 font-mono' },
    { key: 'title',          header: 'Title',       render: (r) => <span className="font-medium">{r.title}</span> },
    { key: 'counterparty',   header: 'Counterparty' },
    { key: 'contractType',   header: 'Type',        render: (r) => <span className="status-chip bg-surface-100 text-ink-600">{r.contractType}</span> },
    { key: 'value',          header: 'Value',       tdClassName: 'num font-medium', render: (r) => formatCurrency(r.value, r.currency) },
    { key: 'endDate',        header: 'Expires',     render: (r) => r.endDate ? formatDate(r.endDate) : <span className="text-ink-300">Open-ended</span> },
    { key: 'status',         header: 'Status',      render: (r) => <StatusBadge status={r.status} /> },
  ];

  if (isError) return <div className="page"><div className="flex flex-col items-center justify-center py-24 gap-3"><AlertCircle className="w-10 h-10 text-danger" /><p className="text-[15px] font-medium text-ink-700">Could not load projects</p></div></div>;

  return (
    <div className="page">
      <PageHeader title="Project Finance" subtitle="Projects & Contracts"
        actions={<>
          <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Export</Button>
          {tab === 'projects'  && <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreateP(true)}>New Project</Button>}
          {tab === 'contracts' && <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreateC(true)}>New Contract</Button>}
        </>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Active Projects"  value={projects.filter((p) => p.status === 'Active').length} />
        <KpiCard label="Total Budget"     value={formatCurrency(totalBudget)} accent="default" />
        <KpiCard label="Total Actual"     value={formatCurrency(totalActual)} accent={totalActual > totalBudget ? 'danger' : 'success'} />
        <KpiCard label="Over Budget"      value={overBudget}                  accent={overBudget > 0 ? 'danger' : 'default'} />
      </div>

      <div className="flex gap-1 border-b border-border mb-4">
        {(['projects', 'contracts'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={clsx('px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px capitalize', tab === t ? 'border-gold-500 text-ink-900' : 'border-transparent text-ink-600 hover:text-ink-900')}>
            {t === 'projects' ? `Projects (${projects.length})` : `Contracts (${contracts.length})`}
          </button>
        ))}
      </div>

      {tab === 'projects' && <DataTable columns={projectCols} data={projects} keyField="id" isLoading={loadP} onRowClick={setSelected} emptyMessage="No projects." emptyIcon={<FolderKanban className="w-8 h-8" />} />}
      {tab === 'contracts' && <DataTable columns={contractCols} data={contracts} keyField="id" isLoading={loadC} emptyMessage="No contracts." emptyIcon={<FolderKanban className="w-8 h-8" />} />}

      {selected && (
        <DetailDrawer title={selected.name} subtitle={selected.projectCode} onClose={() => setSelected(null)}
          tabs={[
            { id: 'details', label: 'Details', content: (
              <dl>{[
                { label: 'Project Code', value: selected.projectCode },
                { label: 'Start Date',   value: formatDate(selected.startDate) },
                { label: 'End Date',     value: selected.endDate ? formatDate(selected.endDate) : '—' },
                { label: 'Budget',       value: formatCurrency(selected.budget, selected.currency) },
                { label: 'Actual Cost',  value: <span className={Number(selected.actualCost) > Number(selected.budget) ? 'text-danger font-semibold' : 'font-semibold'}>{formatCurrency(selected.actualCost, selected.currency)}</span> },
                { label: 'Billed',       value: formatCurrency(selected.billedAmount, selected.currency) },
                { label: 'Status',       value: <StatusBadge status={selected.status as any} /> },
              ].map(({ label, value }) => <div key={label} className="flex justify-between py-2.5 border-b border-border last:border-0"><dt className="text-[13px] text-ink-600">{label}</dt><dd className="text-[13px] text-ink-900 font-medium">{value}</dd></div>)}</dl>
            )},
            { id: 'audit', label: 'Audit Trail', content: <AuditTrailTab tenantId={tenantId} resourceType="project" resourceId={selected.id} /> },
            { id: 'documents', label: 'Documents', content: <DocumentsTab /> },
          ]}
        />
      )}

      {showCreateP && (
        <Modal title="New Project" onClose={() => { setShowCreateP(false); resp(); }}
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setShowCreateP(false); resp(); }}>Cancel</Button><Button form="create-proj-form" type="submit" isLoading={createProjectMutation.isPending}>Create Project</Button></div>}
        >
          <form id="create-proj-form" className="space-y-4" onSubmit={hsp((d) => createProjectMutation.mutate(d))} noValidate>
            <Input label="Project Name" required {...rp('name')} />
            <Input label="Description"  {...rp('description')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Start Date" type="date" required {...rp('startDate')} />
              <Input label="End Date"   type="date"          {...rp('endDate')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Budget" type="number" min="0" step="0.01" {...rp('budget', { valueAsNumber: true })} />
              <Select label="Currency" options={CURRENCIES} {...rp('currency')} />
            </div>
            {createProjectMutation.isError && <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">Failed to create project.</p>}
          </form>
        </Modal>
      )}

      {showCreateC && (
        <Modal title="New Contract" onClose={() => { setShowCreateC(false); resc(); }}
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setShowCreateC(false); resc(); }}>Cancel</Button><Button form="create-contract-form" type="submit" isLoading={createContractMutation.isPending}>Create Contract</Button></div>}
        >
          <form id="create-contract-form" className="space-y-4" onSubmit={hsc((d) => createContractMutation.mutate(d))} noValidate>
            <Input label="Contract Title" required {...rc('title')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Counterparty"   required {...rc('counterparty')} />
              <Select label="Type" options={CONTRACT_TYPES} {...rc('contractType')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Start Date" type="date" required {...rc('startDate')} />
              <Input label="End Date"   type="date"          {...rc('endDate')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Value" type="number" min="0" step="0.01" {...rc('value', { valueAsNumber: true })} />
              <Select label="Currency" options={CURRENCIES} {...rc('currency')} />
            </div>
            {createContractMutation.isError && <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">Failed to create contract.</p>}
          </form>
        </Modal>
      )}
    </div>
  );
}
