// ─── API Response ─────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  meta?: Record<string, unknown>;
  correlationId?: string;
}

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  platformRole?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  tenantSlug: string | null;
  isAuthenticated: boolean;
}

// ─── Tenant ───────────────────────────────────────────────────────────────────
export interface Tenant {
  id: string;
  slug: string;
  legalName: string;
  displayName: string;
  country: string;
  timezone: string;
  baseCurrency: string;
  isActive: boolean;
  onboardingStep: number;
  createdAt: string;
}

// ─── Status ───────────────────────────────────────────────────────────────────
export type RecordStatus =
  | 'Draft'
  | 'Pending'
  | 'Approved'
  | 'Posted'
  | 'Partially Paid'
  | 'Paid'
  | 'Rejected'
  | 'Cancelled'
  | 'Closed'
  | 'Exception';

// ─── GL ───────────────────────────────────────────────────────────────────────
export interface GlAccount {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  accountType: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  normalBalance: 'Debit' | 'Credit';
  parentId: string | null;
  isActive: boolean;
}

export interface GlJournal {
  id: string;
  tenantId: string;
  journalNumber: string;
  description: string;
  fiscalPeriodId: string;
  postingDate: string;
  status: RecordStatus;
  sourceModule?: string;
  createdBy: string;
  lines: GlJournalLine[];
}

export interface GlJournalLine {
  id: string;
  journalId: string;
  lineNumber: number;
  accountId: string;
  description?: string;
  debit: number;
  credit: number;
  currency: string;
  exchangeRate: number;
  dimensions?: Record<string, string>;
}
