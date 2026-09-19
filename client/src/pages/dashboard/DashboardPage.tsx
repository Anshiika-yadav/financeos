import React from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { useAuth } from '../../store/auth.context';
import { clsx } from 'clsx';

// The dashboard is role-aware. Roles map to different view configurations.
type DashboardRole = 'executive' | 'controller' | 'operational' | 'default';

function inferDashboardRole(permittedScope: string[]): DashboardRole {
  const has = (s: string) => permittedScope.includes(s);
  if (has('*:*:*')) return 'executive';
  if (has('*:report:read') && has('*:fiscal_period:configure')) return 'controller';
  if (permittedScope.length > 0) return 'operational';
  return 'default';
}

export function DashboardPage() {
  const { user } = useAuth();
  // permittedScope would come from auth context in a real app
  const role: DashboardRole = 'operational';

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Good morning{user?.firstName ? `, ${user.firstName}` : ''}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here&apos;s what&apos;s happening in your workspace today.
        </p>
      </div>

      {role === 'executive' && <ExecutiveDashboard />}
      {role === 'controller' && <ControllerDashboard />}
      {(role === 'operational' || role === 'default') && <OperationalDashboard />}
    </div>
  );
}

// ─── Executive view ───────────────────────────────────────────────────────────

function ExecutiveDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <KpiCard title="Cash position" value="$2,450,000" trend="+3.2%" positive />
        <KpiCard title="Revenue MTD" value="$840,000" trend="+12.1%" positive />
        <KpiCard title="AP Outstanding" value="$320,000" trend="+5.3%" positive={false} />
        <KpiCard title="AR Outstanding" value="$560,000" trend="-2.1%" positive />
      </div>
      <PlaceholderChart title="P&L Summary" />
    </div>
  );
}

// ─── Controller view ──────────────────────────────────────────────────────────

function ControllerDashboard() {
  const items = [
    { label: 'Open reconciling items', value: 14, status: 'warning' as const },
    { label: 'Periods pending close', value: 2, status: 'warning' as const },
    { label: 'Unposted journals', value: 7, status: 'info' as const },
    { label: 'Exception alerts', value: 3, status: 'error' as const },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {items.map((i) => (
          <StatusCard key={i.label} {...i} />
        ))}
      </div>
      <PlaceholderChart title="Close health checklist" />
    </div>
  );
}

// ─── Operational view ─────────────────────────────────────────────────────────

function OperationalDashboard() {
  const tasks = [
    { id: '1', label: 'Approve bill #INV-0042 — $4,500', due: 'Today', urgent: true },
    { id: '2', label: 'Review expense report from J. Smith', due: 'Today', urgent: false },
    { id: '3', label: 'Post journal JNL-0123', due: 'Tomorrow', urgent: false },
    { id: '4', label: 'Reconcile Westpac account — Sep', due: 'Sep 20', urgent: false },
  ];

  return (
    <div className="space-y-6">
      <section aria-labelledby="tasks-heading">
        <h2
          id="tasks-heading"
          className="text-base font-semibold text-gray-900 mb-3"
        >
          My tasks
        </h2>
        <div className="bg-white rounded-lg shadow divide-y">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {task.urgent ? (
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" aria-label="Urgent" />
                ) : (
                  <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
                )}
                <span className="text-sm text-gray-700">{task.label}</span>
              </div>
              <span className={clsx('text-xs', task.urgent ? 'text-red-600 font-medium' : 'text-gray-400')}>
                {task.due}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="approvals-heading">
        <h2 id="approvals-heading" className="text-base font-semibold text-gray-900 mb-3">
          Pending approvals
        </h2>
        <div className="bg-white rounded-lg shadow">
          <p className="text-sm text-gray-500 px-4 py-8 text-center">
            No pending approvals — you&apos;re all caught up!
          </p>
        </div>
      </section>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  trend,
  positive,
}: {
  title: string;
  value: string;
  trend: string;
  positive: boolean;
}) {
  const TrendIcon = positive ? TrendingUp : TrendingDown;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <div className={clsx('flex items-center gap-1 mt-1 text-xs', positive ? 'text-green-600' : 'text-red-500')}>
        <TrendIcon className="w-3 h-3" aria-hidden="true" />
        <span>{trend} vs last month</span>
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: 'warning' | 'info' | 'error';
}) {
  const classes = {
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };

  return (
    <div className={clsx('rounded-lg border p-4', classes[status])}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-1">{label}</p>
    </div>
  );
}

function PlaceholderChart({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="h-48 rounded bg-gray-50 flex items-center justify-center text-sm text-gray-400">
        Chart renders here — wire to report endpoints in Phase 4
      </div>
    </div>
  );
}
