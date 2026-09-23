import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  ReceiptText,
  Landmark,
  ShoppingCart,
  Receipt,
  Package,
  Layers,
  FolderKanban,
  BarChart3,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Building2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../store/auth.context';

import type { LucideIcon } from 'lucide-react';

// ─── Nav tree ─────────────────────────────────────────────────────────────────

interface NavChild { label: string; to: string; }
interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',  label: 'Dashboard',          to: '/dashboard',            icon: LayoutDashboard },
  {
    id: 'gl', label: 'General Ledger', to: '/gl', icon: BookOpen,
    children: [
      { label: 'Chart of Accounts', to: '/gl/accounts' },
      { label: 'Journal Entries',   to: '/gl/journals' },
      { label: 'Trial Balance',     to: '/gl/trial-balance' },
    ],
  },
  {
    id: 'ap', label: 'Accounts Payable', to: '/ap', icon: FileText,
    children: [
      { label: 'Bills',         to: '/ap/bills' },
      { label: 'Payment Runs',  to: '/ap/payments' },
      { label: 'Suppliers',     to: '/ap/suppliers' },
    ],
  },
  {
    id: 'ar', label: 'Accounts Receivable', to: '/ar', icon: ReceiptText,
    children: [
      { label: 'Sales Invoices', to: '/ar/invoices' },
      { label: 'Customers',      to: '/ar/customers' },
      { label: 'Collections',    to: '/ar/collections' },
    ],
  },
  {
    id: 'treasury', label: 'Cash & Treasury', to: '/treasury', icon: Landmark,
    children: [
      { label: 'Cash Position',  to: '/treasury/accounts' },
      { label: 'Reconciliation', to: '/treasury/reconciliation' },
    ],
  },
  {
    id: 'procurement', label: 'Procurement', to: '/procurement', icon: ShoppingCart,
    children: [
      { label: 'Purchase Requests', to: '/procurement/requests' },
      { label: 'Purchase Orders',   to: '/procurement/orders' },
    ],
  },
  { id: 'expenses',  label: 'Expenses',           to: '/expenses',   icon: Receipt },
  { id: 'assets',    label: 'Fixed Assets',        to: '/assets',     icon: Building2 },
  { id: 'inventory', label: 'Inventory',           to: '/inventory',  icon: Package },
  { id: 'projects',  label: 'Projects & Contracts',to: '/projects',   icon: FolderKanban },
  { id: 'budgeting', label: 'Planning & Budgets',  to: '/budgeting',  icon: BarChart3 },
];

// ─── AppShell ─────────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Determine which nav group should be open from the current path
  const activeGroup = NAV_ITEMS.find(
    (item) =>
      item.children &&
      item.children.some((c) => location.pathname.startsWith(c.to)),
  )?.id ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      {/* ── Sidebar ── */}
      <aside
        className={clsx(
          'flex flex-col flex-shrink-0 bg-navy-950 transition-all duration-200',
          sidebarOpen ? 'w-60' : 'w-14',
        )}
        aria-label="Main navigation"
      >
        {/* Logo row */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-navy-700 flex-shrink-0">
          {sidebarOpen && (
            <span className="text-white font-bold text-[17px] tracking-tight select-none">
              Finance<span className="text-gold-500">OS</span>
            </span>
          )}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="text-navy-200 hover:text-white p-1 rounded transition-colors ml-auto"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2" aria-label="Modules">
          {NAV_ITEMS.map((item) => (
            <NavGroup
              key={item.id}
              item={item}
              collapsed={!sidebarOpen}
              defaultOpen={item.id === activeGroup}
            />
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-navy-700 px-3 py-3 flex-shrink-0">
          {sidebarOpen ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-white truncate leading-tight">
                  {user ? `${user.firstName} ${user.lastName}` : 'User'}
                </p>
                <p className="text-[11px] text-navy-200 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-navy-200 hover:text-white p-1.5 rounded transition-colors flex-shrink-0"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="text-navy-200 hover:text-white p-1.5 rounded transition-colors w-full flex justify-center"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main
        className="flex-1 overflow-y-auto focus:outline-none"
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}

// ─── NavGroup ─────────────────────────────────────────────────────────────────

function NavGroup({
  item,
  collapsed,
  defaultOpen,
}: {
  item: NavItem;
  collapsed: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = item.icon;

  // Keep group open when sidebar expands and this group is active
  useEffect(() => {
    if (!collapsed && defaultOpen) setOpen(true);
  }, [collapsed, defaultOpen]);

  if (!item.children) {
    return (
      <NavLink
        to={item.to}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          clsx(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-[6px] text-[13px] font-medium transition-colors',
            isActive
              ? 'bg-gold-500/10 text-gold-500'
              : 'text-navy-100 hover:bg-navy-900 hover:text-white',
          )
        }
      >
        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={() => !collapsed && setOpen((o) => !o)}
        title={collapsed ? item.label : undefined}
        className={clsx(
          'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[6px] text-[13px] font-medium transition-colors',
          open && !collapsed
            ? 'text-white'
            : 'text-navy-100 hover:bg-navy-900 hover:text-white',
        )}
        aria-expanded={!collapsed ? open : undefined}
      >
        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden />
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{item.label}</span>
            <ChevronDown
              className={clsx('w-3.5 h-3.5 flex-shrink-0 transition-transform', open && 'rotate-180')}
              aria-hidden
            />
          </>
        )}
      </button>

      {!collapsed && open && (
        <div className="ml-6 mt-0.5 space-y-0.5 mb-1">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) =>
                clsx(
                  'block px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors',
                  isActive
                    ? 'bg-gold-500/15 text-gold-400'
                    : 'text-navy-200 hover:bg-navy-900 hover:text-white',
                )
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
