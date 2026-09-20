import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Search, Send, CheckCircle2, Stamp, AlertCircle, FileText } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { apiGet, apiPost, apiPatch } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuth } from '../../store/auth.context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JournalLine {
  id: string;
  lineNumber: number;
  accountId: string;
  description?: string;
  debit: number;
  credit: number;
  currency: string;
  account?: { code: string; name: string };
}

interface Journal {
  id: string;
  journalNumber: string;
  description: string;
  postingDate: string;
  status: string;
  totalDebit: number;
  totalCredit: number;
  createdBy: string;
  approvedBy?: string;
  postedBy?: string;
  lines?: JournalLine[];
  period?: { name: string; status: string };
}

interface FiscalPeriod { id: string; name: string; status: string; }
interface GlAccount    { id: string; code: string; name: string; }

const STATUS_FILTERS = ['', 'Draft', 'Pending', 'Approved', 'Posted'];

// ─── Component ────────────────────────────────────────────────────────────────

export function JournalsPage() {
  const { tenantContext } = useAuth() as any;
  const tenantId = tenantContext?.tenantId ?? '';
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter]     = useState('');
  const [search, setSearch]                 = useState('');
  const [showCreate, setShowCreate]         = useState(false);
  const [selected, setSelected]             = useState<Journal | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: result, isLoading, isError } = useQuery<{ data: Journal[] }>({
    queryKey: ['gl-journals', statusFilter],
    queryFn: () => apiGet('/gl/journals', { ...(statusFilter ? { status: statusFilter } : {}), limit: 100 }),
  });
  const { data: periods = [] } = useQuery<FiscalPeriod[]>({
    queryKey: ['gl-periods'],
    queryFn: () => apiGet('/gl/periods'),
  });
  const { data: accounts = [] } = useQuery<GlAccount[]>({
    queryKey: ['gl-accounts'],
    queryFn: () => apiGet('/gl/accounts'),
  });

  const journals = result?.data ?? [];
  const filtered = journals.filter((j) => {
    const q = search.toLowerCase();
    return !q || j.journalNumber.toLowerCase().includes(q) || j.description.toLowerCase().includes(q);
  });

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const count   = (s: string) => journals.filter((j) => j.status === s).length;
  const drafts  = count('Draft');
  const pending = count('Pending');
  const posted  = count('Posted');

  // ── Mutations ───────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['gl-journals'] });
    if (selected) {
      qc.invalidateQueries({ queryKey: ['gl-journal', selected.id] });
    }
  };

  const submitMutation  = useMutation({ mutationFn: (id: string) => apiPatch(`/gl/journals/${id}/submit`),  onSuccess: invalidate });
  const approveMutation = useMutation({ mutationFn: (id: string) => apiPatch(`/gl/journals/${id}/approve`), onSuccess: invalidate });
  const postMutation    = useMutation({ mutationFn: (id: string) => apiPatch(`/gl/journals/${id}/post`),    onSuccess: invalidate });

  // ── Detail query (when drawer open) ─────────────────────────────────────────
  const { data: detailJournal } = useQuery<Journal>({
    queryKey: ['gl-journal', selected?.id],
    queryFn: () => apiGet(`/gl/journals/${selected!.id}`),
    enabled: !!selected,
  });

  // ── Create form ──────────────────────────────────────────────────────────────
  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm({
    defaultValues: {
      description: '',
      fiscalPeriodId: '',
      postingDate: new Date().toISOString().split('T')[0],
      lines: [
        { accountId: '', description: '', debit: 0, credit: 0, currency: 'USD' },
        { accountId: '', description: '', debit: 0, credit: 0, currency: 'USD' },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const linesWatch = watch('lines');
  const totalDebit  = linesWatch.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = linesWatch.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.001;

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiPost('/gl/journals', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gl-journals'] }); setShowCreate(false); reset(); },
  });

  // ── Columns ─────────────────────────────────────────────────────────────────
  const columns: Column<Journal>[] = [
    {
      key: 'journalNumber',
      header: 'Number',
      className: 'w-36',
      render: (r) => <span className="font-mono text-[13px] font-medium text-ink-900">{r.journalNumber}</span>,
    },
    { key: 'description', header: 'Description', className: 'max-w-xs truncate' },
    { key: 'postingDate', header: 'Date',   render: (r) => formatDate(r.postingDate) },
    { key: 'period',      header: 'Period', render: (r) => r.period?.name ?? '—' },
    {
      key: 'totalDebit',
      header: 'Debit',
      className: 'w-32',
      tdClassName: 'num',
      render: (r) => formatCurrency(r.totalDebit),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      className: 'w-28',
      render: (r) => (
        <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
          {r.status === 'Draft' && (
            <button
              onClick={() => submitMutation.mutate(r.id)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-info hover:text-blue-800 transition-colors"
            >
              <Send className="w-3 h-3" />Submit
            </button>
          )}
          {r.status === 'Pending' && (
            <button
              onClick={() => approveMutation.mutate(r.id)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-success hover:text-green-800 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" />Approve
            </button>
          )}
          {r.status === 'Approved' && (
            <button
              onClick={() => postMutation.mutate(r.id)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6D28D9] hover:text-purple-800 transition-colors"
            >
              <Stamp className="w-3 h-3" />Post
            </button>
          )}
        </div>
      ),
    },
  ];

  if (isError) {
    return (
      <div className="page">
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <AlertCircle className="w-10 h-10 text-danger" />
          <p className="text-[15px] font-medium text-ink-700">Could not load journals</p>
          <p className="text-[13px] text-ink-600">You may not have permission to view this module.</p>
        </div>
      </div>
    );
  }

  const openPeriods = periods.filter((p) => p.status === 'Open');

  return (
    <div className="page">
      <PageHeader
        title="Journal Entries"
        subtitle="General Ledger"
        actions={
          <>
            <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>
              Export
            </Button>
            <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreate(true)}>
              New Journal
            </Button>
          </>
        }
      />

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Journals"    value={journals.length} />
        <KpiCard label="Drafts"            value={drafts}  accent={drafts > 0 ? 'warning' : 'default'} />
        <KpiCard label="Pending Approval"  value={pending} accent={pending > 0 ? 'warning' : 'default'} />
        <KpiCard label="Posted"            value={posted}  accent="success" />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search journals…"
            className="field-input pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`filter-chip ${statusFilter === s ? 'filter-chip--active' : ''}`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={filtered}
        keyField="id"
        isLoading={isLoading}
        isError={isError}
        onRowClick={(row) => setSelected(row)}
        emptyMessage="No journal entries found. Create one to get started."
        emptyIcon={<FileText className="w-8 h-8" />}
      />

      {/* ── Detail drawer ── */}
      {selected && (
        <DetailDrawer
          title={detailJournal?.journalNumber ?? selected.journalNumber}
          subtitle={detailJournal?.description ?? selected.description}
          onClose={() => setSelected(null)}
          actions={
            <div className="flex gap-2">
              {(detailJournal?.status ?? selected.status) === 'Draft' && (
                <Button size="sm" variant="secondary" isLoading={submitMutation.isPending}
                  onClick={() => submitMutation.mutate(selected.id)}>
                  Submit
                </Button>
              )}
              {(detailJournal?.status ?? selected.status) === 'Pending' && (
                <Button size="sm" variant="gold" isLoading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(selected.id)}>
                  Approve
                </Button>
              )}
              {(detailJournal?.status ?? selected.status) === 'Approved' && (
                <Button size="sm" isLoading={postMutation.isPending}
                  onClick={() => postMutation.mutate(selected.id)}>
                  Post to GL
                </Button>
              )}
            </div>
          }
          tabs={[
            {
              id: 'lines',
              label: 'Journal Lines',
              content: (
                <div className="space-y-4">
                  {/* Meta */}
                  <div className="grid grid-cols-2 gap-3 text-[13px]">
                    {[
                      { label: 'Status',       value: <StatusBadge status={detailJournal?.status ?? selected.status} /> },
                      { label: 'Posting Date', value: formatDate(detailJournal?.postingDate ?? selected.postingDate) },
                      { label: 'Period',       value: detailJournal?.period?.name ?? '—' },
                      { label: 'Total Debit',  value: <span className="font-mono">{formatCurrency(detailJournal?.totalDebit ?? selected.totalDebit)}</span> },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <span className="text-ink-600 text-[11px] uppercase tracking-wider">{label}</span>
                        <span className="text-ink-900 font-medium">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Lines table */}
                  <div className="rounded-card border border-border overflow-hidden">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Account</th>
                          <th>Description</th>
                          <th className="num">Debit</th>
                          <th className="num">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detailJournal?.lines ?? []).map((line) => (
                          <tr key={line.id}>
                            <td className="text-ink-400 text-[12px]">{line.lineNumber}</td>
                            <td>
                              <span className="font-mono text-[12px] text-ink-600">{line.account?.code}</span>
                              <span className="ml-2 text-[13px]">{line.account?.name}</span>
                            </td>
                            <td className="text-ink-600">{line.description ?? '—'}</td>
                            <td className="num">{line.debit > 0 ? formatCurrency(line.debit) : ''}</td>
                            <td className="num">{line.credit > 0 ? formatCurrency(line.credit) : ''}</td>
                          </tr>
                        ))}
                        {/* Totals row */}
                        {(detailJournal?.lines?.length ?? 0) > 0 && (
                          <tr className="bg-surface-50 font-semibold text-[13px]">
                            <td colSpan={3} className="text-right text-ink-600 text-[11px] uppercase tracking-wider">Total</td>
                            <td className="num">{formatCurrency(detailJournal?.totalDebit ?? 0)}</td>
                            <td className="num">{formatCurrency(detailJournal?.totalCredit ?? 0)}</td>
                          </tr>
                        )}
                        {(detailJournal?.lines?.length ?? 0) === 0 && (
                          <tr><td colSpan={5} className="text-center text-ink-400 py-6 text-[13px]">Loading lines…</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ),
            },
            {
              id: 'audit',
              label: 'Audit Trail',
              content: <AuditTrailTab tenantId={tenantId} resourceType="journal" resourceId={selected.id} />,
            },
            {
              id: 'documents',
              label: 'Documents',
              content: <DocumentsTab />,
            },
          ]}
        />
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <Modal
          title="New Journal Entry"
          subtitle="Entry will be saved as Draft. Submit for approval when ready."
          size="xl"
          onClose={() => { setShowCreate(false); reset(); }}
          footer={
            <div className="flex items-center justify-between">
              <span className={`text-[12px] font-medium ${isBalanced ? 'text-success' : 'text-danger'}`}>
                {isBalanced
                  ? `✓ Balanced — ${formatCurrency(totalDebit)}`
                  : `⚠ Out of balance by ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button>
                <Button form="create-journal-form" type="submit" isLoading={createMutation.isPending} disabled={!isBalanced}>
                  Save Journal
                </Button>
              </div>
            </div>
          }
        >
          <form id="create-journal-form" className="space-y-4" onSubmit={handleSubmit((d) => createMutation.mutate(d))} noValidate>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Description" required {...register('description')} />
              <Input label="Posting Date" type="date" required {...register('postingDate')} />
            </div>
            <Select
              label="Fiscal Period"
              required
              options={openPeriods.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Select an open period…"
              {...register('fiscalPeriodId')}
            />

            {/* Lines */}
            <div>
              <p className="field-label mb-2">Journal Lines</p>
              <div className="rounded-card border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead className="bg-surface-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-600">Account</th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-600">Description</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-600 w-28">Debit</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-600 w-28">Credit</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fields.map((field, i) => (
                      <tr key={field.id}>
                        <td className="px-2 py-1.5">
                          <select className="field-input text-[12px] py-1" {...register(`lines.${i}.accountId`)}>
                            <option value="">Select account…</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="field-input text-[12px] py-1" placeholder="Description" {...register(`lines.${i}.description`)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.01" min="0" className="field-input text-[12px] py-1 text-right" {...register(`lines.${i}.debit`, { valueAsNumber: true })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.01" min="0" className="field-input text-[12px] py-1 text-right" {...register(`lines.${i}.credit`, { valueAsNumber: true })} />
                        </td>
                        <td className="px-2 py-1.5">
                          {fields.length > 2 && (
                            <button type="button" onClick={() => remove(i)} className="text-ink-400 hover:text-danger transition-colors text-[16px] leading-none">×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 border-t border-border bg-surface-50">
                  <button
                    type="button"
                    onClick={() => append({ accountId: '', description: '', debit: 0, credit: 0, currency: 'USD' })}
                    className="text-[12px] text-info hover:text-blue-800 font-medium transition-colors"
                  >
                    + Add line
                  </button>
                </div>
              </div>
            </div>
            {createMutation.isError && (
              <p className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">
                Failed to save journal. Ensure it balances and a period is selected.
              </p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
