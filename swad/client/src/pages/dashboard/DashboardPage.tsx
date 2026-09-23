import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, AlertCircle, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../store/auth.context';
import { apiGet } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const { user } = useAuth();

  const { data: cashPos } = useQuery({ queryKey: ['cash-position'], queryFn: () => apiGet<{ totalCash: number; pendingPayments: number; outstandingAR: number }>('/treasury/cash-position') });
  const { data: billsResult } = useQuery({ queryKey: ['bills-dashboard'], queryFn: () => apiGet<{ data: { id: string; billNumber: string; totalAmount: number; dueDate: string; supplier: { name: string }; status: string }[] }>('/ap/bills', { limit: 5 }) });
  const { data: invoicesResult } = useQuery({ queryKey: ['invoices-dashboard'], queryFn: () => apiGet<{ data: { id: string; invoiceNumber: string; totalAmount: number; dueDate: string; customer: { name: string }; status: string }[] }>('/ar/invoices', { limit: 5 }) });
  const { data: expenses } = useQuery({ queryKey: ['expense-claims'], queryFn: () => apiGet<{ id: string; claimNumber: string; totalAmount: number; status: string; description: string }[]>('/expenses/claims') });
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: () => apiGet<{ id: string; name: string; budget: number; actualCost: number; status: string }[]>('/projects') });
  const { data: trialBalance } = useQuery({ queryKey: ['trial-balance'], queryFn: () => apiGet<{ accountType: string; totalDebit: number; totalCredit: number; balance: number }[]>('/gl/trial-balance') });

  const bills = billsResult?.data ?? [];
  const invoices = invoicesResult?.data ?? [];

  const revenue = trialBalance?.filter(l => l.accountType === 'Revenue').reduce((s, l) => s + Math.abs(l.balance), 0) ?? 0;
  const expenses_total = trialBalance?.filter(l => l.accountType === 'Expense').reduce((s, l) => s + Math.abs(l.balance), 0) ?? 0;
  const netIncome = revenue - expenses_total;

  const pendingBills = bills.filter(b => b.status === 'Pending').length;
  const pendingInvoices = invoices.filter(i => i.status === 'Pending').length;
  const pendingExpenses = (expenses ?? []).filter(e => e.status === 'Pending').length;
  const overdueBills = bills.filter(b => new Date(b.dueDate) < new Date() && !['Paid', 'Cancelled'].includes(b.status)).length;

  const tasks = [
    ...bills.filter(b => b.status === 'Pending').map(b => ({ id: b.id, type: 'bill', label: `Approve bill ${b.billNumber} — ${b.supplier?.name}`, amount: b.totalAmount, due: b.dueDate, link: '/ap/bills', urgent: new Date(b.dueDate) < new Date() })),
    ...invoices.filter(i => i.status === 'Pending').map(i => ({ id: i.id, type: 'invoice', label: `Approve invoice ${i.invoiceNumber} — ${i.customer?.name}`, amount: i.totalAmount, due: i.dueDate, link: '/ar/invoices', urgent: false })),
    ...(expenses ?? []).filter(e => e.status === 'Pending').map(e => ({ id: e.id, type: 'expense', label: `Review expense claim ${e.claimNumber}`, amount: e.totalAmount, due: '', link: '/expenses', urgent: false })),
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Good morning{user?.firstName ? `, ${user.firstName}` : ''}</h1>
        <p className="text-sm text-gray-500 mt-1">Here's your financial position at a glance.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard title="Total Cash" value={formatCurrency(cashPos?.totalCash ?? 0)} sub="All bank accounts" trend="up" />
        <KpiCard title="Revenue YTD" value={formatCurrency(revenue)} sub="Posted journals" trend="up" />
        <KpiCard title="Net Income YTD" value={formatCurrency(netIncome)} sub={netIncome >= 0 ? 'Profitable' : 'Loss'} trend={netIncome >= 0 ? 'up' : 'down'} />
        <KpiCard title="Outstanding AR" value={formatCurrency(cashPos?.outstandingAR ?? 0)} sub="Receivable from customers" trend="neutral" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Alerts */}
        <div className="bg-white rounded-lg shadow p-4 col-span-1">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Alerts</h2>
          <div className="space-y-2">
            {overdueBills > 0 && <Alert type="danger" message={`${overdueBills} overdue supplier bill${overdueBills > 1 ? 's' : ''}`} link="/ap/bills" />}
            {pendingBills > 0 && <Alert type="warning" message={`${pendingBills} bill${pendingBills > 1 ? 's' : ''} pending approval`} link="/ap/bills" />}
            {pendingInvoices > 0 && <Alert type="warning" message={`${pendingInvoices} invoice${pendingInvoices > 1 ? 's' : ''} pending approval`} link="/ar/invoices" />}
            {pendingExpenses > 0 && <Alert type="info" message={`${pendingExpenses} expense claim${pendingExpenses > 1 ? 's' : ''} awaiting review`} link="/expenses" />}
            {overdueBills === 0 && pendingBills === 0 && pendingInvoices === 0 && pendingExpenses === 0 && (
              <div className="flex items-center gap-2 text-green-600 text-sm"><CheckCircle className="w-4 h-4" />All caught up!</div>
            )}
          </div>
        </div>

        {/* My Tasks */}
        <div className="bg-white rounded-lg shadow p-4 col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Pending Approvals</h2>
            <span className="bg-brand-100 text-brand-700 text-xs font-medium px-2 py-0.5 rounded-full">{tasks.length}</span>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No pending approvals — you're all caught up!</p>
          ) : (
            <div className="space-y-2">
              {tasks.slice(0, 6).map(task => (
                <Link to={task.link} key={`${task.type}-${task.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-2">
                    {task.urgent ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" /> : <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <span className="text-sm text-gray-700 group-hover:text-brand-600">{task.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(task.amount)}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-brand-600" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project Health */}
      {(projects ?? []).length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Project Budget Health</h2>
            <Link to="/projects" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {(projects ?? []).slice(0, 4).map(p => {
              const pct = Number(p.budget) > 0 ? Math.min(Math.round((Number(p.actualCost) / Number(p.budget)) * 100), 100) : 0;
              return (
                <div key={p.id} className="flex items-center gap-4">
                  <span className="text-sm text-gray-700 w-52 truncate">{p.name}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-orange-400' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                  <span className="text-xs text-gray-400 w-28 text-right">{formatCurrency(Number(p.actualCost))} / {formatCurrency(Number(p.budget))}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value, sub, trend }: { title: string; value: string; sub: string; trend: 'up' | 'down' | 'neutral' }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <div className={clsx('flex items-center gap-1 mt-1 text-xs', trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400')}>
        {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
        <span>{sub}</span>
      </div>
    </div>
  );
}

function Alert({ type, message, link }: { type: 'danger' | 'warning' | 'info'; message: string; link: string }) {
  const styles = { danger: 'text-red-700 bg-red-50', warning: 'text-yellow-700 bg-yellow-50', info: 'text-blue-700 bg-blue-50' };
  const icons = { danger: <AlertCircle className="w-4 h-4 flex-shrink-0" />, warning: <Clock className="w-4 h-4 flex-shrink-0" />, info: <CheckCircle className="w-4 h-4 flex-shrink-0" /> };
  return (
    <Link to={link} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity ${styles[type]}`}>
      {icons[type]}{message}
    </Link>
  );
}
