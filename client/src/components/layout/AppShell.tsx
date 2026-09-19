import React, { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Receipt,
  Landmark,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../store/auth.context';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { label: string; to: string }[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  {
    label: 'General Ledger',
    to: '/gl',
    icon: BookOpen,
    children: [
      { label: 'Chart of Accounts', to: '/gl/accounts' },
      { label: 'Journal Entries', to: '/gl/journals' },
      { label: 'Trial Balance', to: '/gl/trial-balance' },
    ],
  },
  {
    label: 'Accounts Payable',
    to: '/ap',
    icon: FileText,
    children: [
      { label: 'Bills', to: '/ap/bills' },
      { label: 'Payment Runs', to: '/ap/payments' },
      { label: 'Suppliers', to: '/ap/suppliers' },
    ],
  },
  {
    label: 'Accounts Receivable',
    to: '/ar',
    icon: Receipt,
    children: [
      { label: 'Sales Invoices', to: '/ar/invoices' },
      { label: 'Customers', to: '/ar/customers' },
      { label: 'Collections', to: '/ar/collections' },
    ],
  },
  {
    label: 'Cash & Treasury',
    to: '/treasury',
    icon: Landmark,
    children: [
      { label: 'Cash Position', to: '/treasury/accounts' },
      { label: 'Reconciliation', to: '/treasury/reconciliation' },
    ],
  },
  {
    label: 'Procurement',
    to: '/procurement',
    icon: Settings,
    children: [
      { label: 'Purchase Requests', to: '/procurement/requests' },
      { label: 'Purchase Orders', to: '/procurement/orders' },
    ],
  },
  { label: 'Expenses', to: '/expenses', icon: Receipt },
  { label: 'Fixed Assets', to: '/assets', icon: Settings },
  { label: 'Inventory', to: '/inventory', icon: Settings },
  { label: 'Projects & Contracts', to: '/projects', icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 flex flex-col" aria-label="Main navigation">
        <div className="px-4 py-5 border-b border-gray-700">
          <span className="text-white font-bold text-xl">FinanceOS</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
          {NAV_ITEMS.map((item) => (
            <NavGroup key={item.to} item={item} />
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user ? `${user.firstName} ${user.lastName}` : 'User'}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white p-1 rounded"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto" id="main-content">
        {children}
      </main>
    </div>
  );
}

function NavGroup({ item }: { item: NavItem }) {
  const [open, setOpen] = React.useState(false);
  const Icon = item.icon;

  if (!item.children) {
    return (
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          clsx(
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            isActive
              ? 'bg-gray-700 text-white'
              : 'text-gray-300 hover:bg-gray-700 hover:text-white',
          )
        }
      >
        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        {item.label}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        aria-expanded={open}
      >
        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={clsx('w-4 h-4 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="ml-7 mt-1 space-y-1">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) =>
                clsx(
                  'block px-3 py-1.5 rounded-md text-sm transition-colors',
                  isActive
                    ? 'text-white bg-gray-700'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700',
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
