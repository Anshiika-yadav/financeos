import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './store/auth.context';
import { AppShell } from './components/layout/AppShell';

// Auth
import { LoginPage } from './pages/auth/LoginPage';
import { SignUpPage } from './pages/auth/SignUpPage';

// Onboarding
import { OnboardingWizard } from './pages/onboarding/OnboardingWizard';

// Dashboard
import { DashboardPage } from './pages/dashboard/DashboardPage';

// GL
import { AccountsPage } from './pages/gl/AccountsPage';
import { JournalsPage } from './pages/gl/JournalsPage';
import { TrialBalancePage } from './pages/gl/TrialBalancePage';

// AP
import { BillsPage } from './pages/ap/BillsPage';
import { SuppliersPage } from './pages/ap/SuppliersPage';
import { PaymentRunsPage } from './pages/ap/PaymentRunsPage';

// AR
import { InvoicesPage } from './pages/ar/InvoicesPage';
import { CustomersPage } from './pages/ar/CustomersPage';
import { CollectionsPage } from './pages/ar/CollectionsPage';

// Treasury
import { CashPositionPage } from './pages/treasury/CashPositionPage';
import { ReconciliationPage } from './pages/treasury/ReconciliationPage';

// Procurement
import { PurchaseRequestsPage } from './pages/procurement/PurchaseRequestsPage';
import { PurchaseOrdersPage } from './pages/procurement/PurchaseOrdersPage';

// Expenses
import { ExpensesPage } from './pages/expenses/ExpensesPage';

// Assets
import { AssetsPage } from './pages/assets/AssetsPage';

// Inventory
import { InventoryPage } from './pages/inventory/InventoryPage';

// Projects
import { ProjectsPage } from './pages/projects/ProjectsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <SignUpPage />} />
      <Route path="/onboarding" element={<OnboardingWizard />} />

      {/* Protected */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

      {/* GL */}
      <Route path="/gl/accounts" element={<ProtectedRoute><AccountsPage /></ProtectedRoute>} />
      <Route path="/gl/journals" element={<ProtectedRoute><JournalsPage /></ProtectedRoute>} />
      <Route path="/gl/trial-balance" element={<ProtectedRoute><TrialBalancePage /></ProtectedRoute>} />

      {/* AP */}
      <Route path="/ap/bills" element={<ProtectedRoute><BillsPage /></ProtectedRoute>} />
      <Route path="/ap/suppliers" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
      <Route path="/ap/payments" element={<ProtectedRoute><PaymentRunsPage /></ProtectedRoute>} />

      {/* AR */}
      <Route path="/ar/invoices" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
      <Route path="/ar/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
      <Route path="/ar/collections" element={<ProtectedRoute><CollectionsPage /></ProtectedRoute>} />

      {/* Treasury */}
      <Route path="/treasury/accounts" element={<ProtectedRoute><CashPositionPage /></ProtectedRoute>} />
      <Route path="/treasury/reconciliation" element={<ProtectedRoute><ReconciliationPage /></ProtectedRoute>} />

      {/* Procurement */}
      <Route path="/procurement/requests" element={<ProtectedRoute><PurchaseRequestsPage /></ProtectedRoute>} />
      <Route path="/procurement/orders" element={<ProtectedRoute><PurchaseOrdersPage /></ProtectedRoute>} />

      {/* Expenses */}
      <Route path="/expenses" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />

      {/* Assets */}
      <Route path="/assets" element={<ProtectedRoute><AssetsPage /></ProtectedRoute>} />

      {/* Inventory */}
      <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />

      {/* Projects */}
      <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
